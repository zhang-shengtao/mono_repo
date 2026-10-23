/**
 * 行头探测：只读前若干字节，绝不为此解析整行
 * （1MB body 整行 JSON.parse 要 377µs，而我们只想要三个字段）。
 *
 * 字段顺序由 facade 保证：`{"level":…,"ts":…,<bindings>,…}`；
 * 子进程补的 time 在 level 之后，不影响这里的探测。
 */
import { levelOf, levelValue } from "./level.js";
import type { LogDirKey, LogLevelName } from "./types.js";

const HEAD_SCAN = 512;
const LEVEL_SCAN = 32;

const TS_PATTERN = /"ts":(\d+)/;
const LOG_TYPE_PATTERN = /"logType":"([^"\\]*)"/;
const LEVEL_PATTERN = /^\{"level":"([a-z]+)"/;

/** `router` → router 目录，其它一律 log（白名单，杜绝用日志字段拼路径） */
export function resolveDirKey(logType: string | undefined): LogDirKey {
  return logType === "router" ? "router" : "log";
}

export function peekLevel(line: string): LogLevelName | undefined {
  const head = line.length > LEVEL_SCAN ? line.slice(0, LEVEL_SCAN) : line;
  return levelOf(LEVEL_PATTERN.exec(head)?.[1]);
}

/** 切分文件需要的两个值：时间戳与目录 */
export function peekHeader(line: string): { ts: number; dirKey: LogDirKey } {
  const head = line.length > HEAD_SCAN ? line.slice(0, HEAD_SCAN) : line;
  const tsMatch = TS_PATTERN.exec(head);
  const dirKey = resolveDirKey(LOG_TYPE_PATTERN.exec(head)?.[1]);
  if (tsMatch) return { ts: Number(tsMatch[1]), dirKey };

  try {
    const record = JSON.parse(line) as { ts?: unknown; logType?: unknown };
    return {
      ts: typeof record.ts === "number" ? record.ts : Date.now(),
      dirKey: resolveDirKey(typeof record.logType === "string" ? record.logType : undefined),
    };
  } catch {
    return { ts: Date.now(), dirKey };
  }
}

/** 队列丢弃优先级：未知级别按 info */
export function lineLevelValue(line: string): number {
  return levelValue(peekLevel(line) ?? "info");
}

/** viewer / CLI 的行过滤（level 为最低级别，grep 为子串） */
export function matchLine(line: string, level?: string, grep?: string): boolean {
  if (grep && !line.includes(grep)) return false;
  const min = levelOf(level);
  if (!min) return true;
  return levelValue(peekLevel(line) ?? "info") >= levelValue(min);
}
