/**
 * 子进程 sink：只负责「把行送进管道」。**没有降级、永久重试。**
 *
 * 铁律：
 * - 写入永不抛（管道 EPIPE 一个漏处理就能把主服务打挂）；
 * - 队列有界，超水位按级别丢弃并计数；
 * - 子进程退出退避重启（200ms→5s 封顶），起不来就每 5s 重试一次；
 * - 代价：子进程挂掉期间日志只存在内存队列里，队列溢出就真丢（dropped 计数可见）。
 */
import { spawn, type ChildProcess } from "node:child_process";
import { onceWithTimeout } from "./async.js";
import {
  buildChildArgs,
  buildChildEnv,
  frameLine,
  resolveChildEntry,
  type ChildLaunchOptions,
} from "./child-process.js";
import { lineLevelValue } from "./line.js";
import { PROTOCOL_VERSION } from "./protocol.js";
import { LEVEL_VALUES, type LogSink, type SinkState, type SinkStats } from "./types.js";

const BACKOFF_MS = [200, 500, 1000, 2000, 5000];
const RETRY_FOREVER_MS = 5000;

export interface ChildSinkOptions extends ChildLaunchOptions {
  maxBufferBytes: number;
  /** 显式子进程入口（默认自动解析） */
  entryPath?: string;
  /** 退出时等子进程收尾的上限 */
  drainTimeoutMs?: number;
  onWarn?: (message: string) => void;
}

export function createChildSink(options: ChildSinkOptions): LogSink & { start(): void } {
  const drainTimeoutMs = options.drainTimeoutMs ?? 3000;
  const onWarn = options.onWarn ?? ((message: string) => process.stderr.write(`[logger] ${message}\n`));

  const queue: string[] = [];
  let queueBytes = 0;
  let blocked = false;
  let child: ChildProcess | null = null;
  let childPid: number | undefined;
  let state: SinkState = "starting";
  let restartTimer: NodeJS.Timeout | null = null;
  let restarts = 0;
  let written = 0;
  let dropped = 0;
  let lastError: string | undefined;
  let stopping = false;

  function enqueue(line: string): void {
    const size = line.length;
    if (queueBytes + size > options.maxBufferBytes) {
      const keepError = lineLevelValue(line) >= LEVEL_VALUES.error && queueBytes + size <= options.maxBufferBytes * 2;
      if (!keepError) {
        dropped++;
        return;
      }
    }
    queue.push(line);
    queueBytes += size;
  }

  function drainQueue(force = false): void {
    const stdin = child?.stdin;
    if (!stdin || !stdin.writable || (blocked && !force)) return;

    while (queue.length > 0) {
      const line = queue.shift();
      if (line === undefined) break;
      queueBytes -= line.length;
      try {
        if (!stdin.write(frameLine(line))) {
          blocked = true;
          if (!force) break;
        }
      } catch (error) {
        lastError = `写入子进程管道失败：${(error as Error).message}`;
        onWarn(lastError);
        break;
      }
    }
  }

  function scheduleRestart(delay: number): void {
    if (stopping) return;
    state = "restart";
    restartTimer = setTimeout(() => {
      restartTimer = null;
      spawnChild();
    }, delay);
    restartTimer.unref();
  }

  function fail(message: string, delay: number): void {
    lastError = message;
    onWarn(message);
    scheduleRestart(delay);
  }

  function handleExit(proc: ChildProcess, code: number | null, signal: NodeJS.Signals | null): void {
    if (child !== proc) return;
    child = null;
    childPid = undefined;
    blocked = false;

    if (stopping) {
      state = "stopped";
      return;
    }

    restarts++;
    fail(
      `子进程退出（code=${code ?? "-"} signal=${signal ?? "-"}），第 ${restarts} 次重启`,
      BACKOFF_MS[Math.min(restarts - 1, BACKOFF_MS.length - 1)] ?? RETRY_FOREVER_MS,
    );
  }

  function spawnChild(): void {
    if (stopping) return;

    const entry = resolveChildEntry(options.entryPath);
    if (!entry) {
      fail("找不到子进程入口 child-main.js（检查 dist 里是否包含 vendor/logger）", RETRY_FOREVER_MS);
      return;
    }

    let proc: ChildProcess;
    try {
      proc = spawn(process.execPath, buildChildArgs(entry, options), {
        stdio: ["pipe", "inherit", "inherit", "ipc"],
        windowsHide: true,
        env: buildChildEnv(options.timezone),
      });
    } catch (error) {
      fail(`spawn 失败：${(error as Error).message}`, RETRY_FOREVER_MS);
      return;
    }

    child = proc;
    state = "starting";

    proc.on("error", (error: Error) => {
      if (child === proc) fail(`子进程错误：${error.message}`, RETRY_FOREVER_MS);
    });
    proc.on("exit", (code, signal) => handleExit(proc, code, signal));
    proc.on("message", (message: unknown) => {
      if (typeof message !== "object" || message === null) return;
      const payload = message as { v?: unknown; type?: unknown; pid?: unknown; message?: unknown; code?: unknown };
      if (payload.v !== PROTOCOL_VERSION) return;

      if (payload.type === "ready") {
        state = "ready";
        childPid = typeof payload.pid === "number" ? payload.pid : proc.pid;
        lastError = undefined;
      } else if (payload.type === "error") {
        lastError = String(payload.message ?? "未知错误");
        onWarn(`子进程报告 ${String(payload.code ?? "OTHER")}：${lastError}`);
      } else if (payload.type === "bye") {
        state = "stopped";
      }
    });

    const stdin = proc.stdin;
    if (!stdin) {
      onWarn("子进程 stdin 不可用");
      return;
    }
    stdin.on("error", (error: Error) => {
      if (stopping) return;
      lastError = `子进程管道出错：${error.message}`;
      onWarn(lastError);
    });
    stdin.on("drain", () => {
      blocked = false;
      drainQueue();
    });
  }

  return {
    start() {
      spawnChild();
    },
    write(line: string) {
      written++;
      if (state === "stopped") {
        dropped++;
        return;
      }
      const stdin = child?.stdin;
      if (blocked || !stdin || !stdin.writable) {
        enqueue(line);
        return;
      }
      try {
        if (!stdin.write(frameLine(line))) blocked = true;
      } catch (error) {
        lastError = `写入子进程管道失败：${(error as Error).message}`;
        enqueue(line);
      }
    },
    flush(cb) {
      drainQueue(true);
      cb?.();
    },
    end(cb) {
      if (stopping) {
        cb?.();
        return;
      }
      stopping = true;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      drainQueue(true);

      const proc = child;
      if (!proc) {
        state = "stopped";
        cb?.();
        return;
      }

      void onceWithTimeout((done) => {
        const timer = setTimeout(() => {
          try {
            proc.kill();
          } catch {}
        }, drainTimeoutMs);
        timer.unref();

        proc.once("exit", () => {
          clearTimeout(timer);
          done();
        });
        try {
          proc.stdin?.end();
        } catch {}
      }, drainTimeoutMs + 1000).then(() => {
        state = "stopped";
        cb?.();
      });
    },
    stats(): SinkStats {
      const stats: SinkStats = { mode: "child", state, written, dropped, restarts };
      if (childPid !== undefined) stats.childPid = childPid;
      if (lastError !== undefined) stats.lastError = lastError;
      return stats;
    },
  };
}
