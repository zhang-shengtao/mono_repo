#!/usr/bin/env node
/**
 * 命令行查看：`repo-log tail --dir logs --service order --type router --follow`
 * 刻意零依赖、无参数库：要在生产服务器直接跑，出错堆栈越简单越好。
 */
import path from "node:path";
import type { LogDirKey } from "./types.js";
import { listLogFiles, readLogLines, tailLog, viewerOptions } from "./viewer.js";

const USAGE = `用法：
  repo-log ls   [--dir logs] [--service order] [--type router|log] [--json]
  repo-log cat  [--dir logs] [--service order] [--type router|log] [--date 2026-10-23]
                [--offset 0] [--limit 500] [--level warn] [--grep 关键词] [--pretty]
  repo-log tail [--dir logs] [--service order] [--type router|log] [--lines 100] [--follow]
                [--level warn] [--grep 关键词] [--pretty]

说明：
  --dir     日志根目录，默认 $LOG_DIR，否则 ./logs
  --service 服务名（对应 LOG_SERVICE，决定是否多一层子目录）
  --type    日志类型，默认 router
  --pretty  彩色单行输出（非 TTY 时自动关闭）`;

interface ParsedArgs {
  command: string;
  values: Map<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "", ...rest] = argv;
  const values = new Map<string, string | true>();

  for (let index = 0; index < rest.length; index++) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      values.set(key, next);
      index++;
    } else {
      values.set(key, true);
    }
  }

  return { command, values };
}

function readString(args: ParsedArgs, key: string): string | undefined {
  const value = args.values.get(key);
  return typeof value === "string" ? value : undefined;
}

function readNumber(args: ParsedArgs, key: string, fallback: number): number {
  const raw = readString(args, key);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFlag(args: ParsedArgs, key: string): boolean {
  return args.values.get(key) === true || args.values.get(key) === "true";
}

const COLORS: Record<string, string> = {
  trace: "\u001b[90m",
  debug: "\u001b[36m",
  info: "\u001b[32m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
  fatal: "\u001b[35m",
};

function formatLine(line: string, pretty: boolean): string {
  if (!pretty) return line;

  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const level = String(record.level ?? "info");
    const time = String(record.time ?? "");
    const where = [record.method, record.url]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join(" ");
    const message = record.msg === undefined ? "" : String(record.msg);

    const rest = { ...record };
    for (const key of ["level", "time", "ts", "msg", "method", "url"]) delete rest[key];
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";

    const color = COLORS[level] ?? "";
    const levelText = color ? `${color}${level.padEnd(5)}\u001b[0m` : level.padEnd(5);
    return `${time} ${levelText} ${where}${where ? " " : ""}${message}${extra}`.trimEnd();
  } catch {
    return line;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === "help" || args.command === "--help") {
    process.stdout.write(`${USAGE}\n`);
    return args.command ? 0 : 1;
  }

  const logDir = path.resolve(readString(args, "dir") ?? process.env.LOG_DIR ?? "logs");
  const service = readString(args, "service") ?? process.env.LOG_SERVICE ?? undefined;
  const logType = (readString(args, "type") ?? "router") as LogDirKey;
  if (logType !== "router" && logType !== "log") {
    process.stderr.write("--type 只能是 router 或 log\n");
    return 1;
  }

  const pretty = readFlag(args, "pretty") && Boolean(process.stdout.isTTY);
  const viewer = viewerOptions(logDir, service);

  if (args.command === "ls") {
    const files = (await listLogFiles(viewer)).filter((file) => file.logType === logType);

    if (readFlag(args, "json")) {
      process.stdout.write(`${JSON.stringify(files, null, 2)}\n`);
      return 0;
    }
    if (files.length === 0) {
      process.stdout.write("还没有日志文件\n");
      return 0;
    }

    let total = 0;
    for (const file of files) {
      total += file.size;
      process.stdout.write(`${file.date}  ${formatSize(file.size).padStart(9)}  ${file.name}\n`);
    }
    process.stdout.write(`共 ${files.length} 个文件，${formatSize(total)}\n`);
    return 0;
  }

  if (args.command === "cat") {
    let count = 0;
    for await (const line of readLogLines({
      ...viewer,
      logType,
      date: readString(args, "date"),
      offset: readNumber(args, "offset", 0),
      limit: readNumber(args, "limit", 500),
      level: readString(args, "level"),
      grep: readString(args, "grep"),
    })) {
      process.stdout.write(`${formatLine(line, pretty)}\n`);
      count++;
    }
    if (count === 0) process.stdout.write("没有匹配的日志\n");
    return 0;
  }

  if (args.command === "tail") {
    for await (const line of tailLog({
      ...viewer,
      logType,
      lines: readNumber(args, "lines", 100),
      follow: readFlag(args, "follow"),
      level: readString(args, "level"),
      grep: readString(args, "grep"),
    })) {
      process.stdout.write(`${formatLine(line, pretty)}\n`);
    }
    return 0;
  }

  process.stderr.write(`未知命令：${args.command}\n${USAGE}\n`);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  },
);
