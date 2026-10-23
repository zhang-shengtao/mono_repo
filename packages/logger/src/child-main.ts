#!/usr/bin/env node
/**
 * 子进程：唯一写盘者。承担 脱敏 → 补 time → 路由 → 切分 → 保留。
 *
 * 退出铁律：stdin EOF 必然退出（主进程被强杀时靠这个收尸）。
 * 协议不匹配直接退出，避免主进程/子进程来自不同版本时写出错行。
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { onceWithTimeout } from "./async.js";
import { resolveLogDirs } from "./config.js";
import { isParentMessage, PROTOCOL_VERSION, type ChildMessage, type RetentionReport } from "./protocol.js";
import { runRetention } from "./retention.js";
import { createRecordTransform } from "./transform.js";
import { LogWriter } from "./writer.js";

const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

function readArg(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  return value !== undefined && !value.startsWith("--") ? value : undefined;
}

function send(message: ChildMessage): void {
  try {
    process.send?.(message);
  } catch {}
}

function reportError(code: "ENOSPC" | "EACCES" | "EPIPE" | "OTHER", error: Error): void {
  send({ v: PROTOCOL_VERSION, type: "error", code, message: error.message });
  process.stderr.write(`[logger] ${code}: ${error.message}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  const protocol = Number(readArg(argv, "protocol") ?? PROTOCOL_VERSION);
  if (protocol !== PROTOCOL_VERSION) {
    process.stderr.write(`[logger] 协议版本不匹配：主进程 ${protocol}，子进程 ${PROTOCOL_VERSION}\n`);
    process.exit(2);
  }

  const timezone = readArg(argv, "timezone");
  if (timezone) process.env.TZ = timezone;

  const logDir = path.resolve(readArg(argv, "log-dir") ?? "logs");
  const service = readArg(argv, "service");
  const retentionDays = Number(readArg(argv, "retention-days") ?? 30);
  const maxFileMb = Number(readArg(argv, "max-file-mb") ?? 10);
  const parentPid = Number(readArg(argv, "parent-pid") ?? 0);
  const redactPaths = (readArg(argv, "redact-paths") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const redactCensor = readArg(argv, "redact-censor") ?? "[Redacted]";

  const dirs = resolveLogDirs({ logDir, service });
  mkdirSync(dirs.router, { recursive: true });
  mkdirSync(dirs.log, { recursive: true });

  const transform = createRecordTransform({ paths: redactPaths, censor: redactCensor });

  const writer = new LogWriter({
    dirs,
    maxFileMb: Number.isFinite(maxFileMb) ? maxFileMb : 0,
    onError: (info) => {
      const code = info.code === "ENOSPC" ? "ENOSPC" : info.code === "EACCES" ? "EACCES" : "OTHER";
      reportError(code, info.error);
    },
  });

  let malformed = 0;
  let lastRetention: RetentionReport | null = null;
  let finishing = false;

  function statsMessage(): ChildMessage {
    const stats = writer.stats();
    return {
      v: PROTOCOL_VERSION,
      type: "stats",
      written: stats.written,
      failedWrites: stats.failedWrites,
      malformed,
      files: stats.files,
      retention: lastRetention,
    };
  }

  async function runRetentionNow(): Promise<void> {
    try {
      const result = await runRetention({
        dirs,
        days: Number.isFinite(retentionDays) ? retentionDays : 0,
        onWarn: (message) => process.stderr.write(`[logger] ${message}\n`),
      });
      lastRetention = { ranAt: result.ranAt, removed: result.removed, skipped: result.skipped, cutoff: result.cutoff };
      if (result.removed > 0) {
        process.stderr.write(`[logger] 已清理 ${result.removed} 个超过 ${retentionDays} 天的日志文件\n`);
      }
    } catch (error) {
      process.stderr.write(`[logger] 清理旧日志失败：${(error as Error).message}\n`);
    }
  }

  const retentionTimer = setInterval(() => void runRetentionNow(), RETENTION_INTERVAL_MS);
  retentionTimer.unref();
  void runRetentionNow();

  async function finish(code: number): Promise<void> {
    if (finishing) return;
    finishing = true;
    clearInterval(retentionTimer);
    await onceWithTimeout((done) => writer.close(done), 3000);

    const stats = writer.stats();
    send({ v: PROTOCOL_VERSION, type: "bye", written: stats.written, failedWrites: stats.failedWrites });
    process.exit(code);
  }

  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  reader.on("line", (line: string) => {
    if (line.length === 0) return;
    const result = transform(line);
    if (result === null) {
      malformed++;
      return;
    }
    if (!writer.write(result.line, { ts: result.ts, dirKey: result.dirKey })) process.stdin.pause();
  });
  reader.on("close", () => void finish(0));
  writer.on("drain", () => process.stdin.resume());
  process.stdin.on("error", (error: Error) => reportError("EPIPE", error));

  process.on("message", (raw: unknown) => {
    if (!isParentMessage(raw)) return;
    switch (raw.type) {
      case "ping":
        send({ v: PROTOCOL_VERSION, type: "ready", pid: process.pid });
        break;
      case "stats":
        send(statsMessage());
        break;
      case "drain":
        send({ v: PROTOCOL_VERSION, type: "drained" });
        break;
      case "rotate":
        writer.rotateNow();
        break;
      default:
        break;
    }
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => void finish(0));
  }

  if (Number.isInteger(parentPid) && parentPid > 0) {
    const watchdog = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        void finish(0);
      }
    }, 5000);
    watchdog.unref();
  }

  process.on("uncaughtException", (error: Error) => reportError("OTHER", error));
  process.on("unhandledRejection", (reason: unknown) =>
    reportError("OTHER", reason instanceof Error ? reason : new Error(String(reason))),
  );

  send({ v: PROTOCOL_VERSION, type: "ready", pid: process.pid });
}

await main();
