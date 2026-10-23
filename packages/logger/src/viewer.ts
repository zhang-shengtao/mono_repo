/**
 * 查看日志：直接读文件，不经过子进程（子进程挂了也能看历史日志）。
 * 读文件的样板在 file-read.ts，行过滤在 line.ts，这里只负责「选文件 + 跟进」。
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { dirFor, resolveLogDirs, type LogDirs } from "./config.js";
import { readFromOffset, readLastLines, readLines } from "./file-read.js";
import { matchLine } from "./line.js";
import type { LogDirKey } from "./types.js";

const LOG_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.log$/;
const LOG_DIR_KEYS: readonly LogDirKey[] = ["router", "log"];

export interface ViewerOptions {
  dirs: LogDirs;
}

export interface LogFileInfo {
  logType: LogDirKey;
  name: string;
  date: string;
  index: number;
  size: number;
  mtimeMs: number;
}

export interface ReadOptions extends ViewerOptions {
  logType: LogDirKey;
  /** 不给则读该类型最新的文件 */
  date?: string;
  offset?: number;
  limit?: number;
  level?: string;
  grep?: string;
}

export interface TailOptions extends ViewerOptions {
  logType: LogDirKey;
  /** 首次输出的末尾行数 */
  lines?: number;
  follow?: boolean;
  pollMs?: number;
  level?: string;
  grep?: string;
}

/** 便捷构造：从 logDir + service 得到 ViewerOptions（CLI / admin 共用） */
export function viewerOptions(logDir: string, service?: string): ViewerOptions {
  return { dirs: resolveLogDirs({ logDir, service }) };
}

export async function listLogFiles(options: ViewerOptions): Promise<LogFileInfo[]> {
  const files: LogFileInfo[] = [];

  for (const logType of LOG_DIR_KEYS) {
    const dir = dirFor(options.dirs, logType);

    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }

    for (const name of names) {
      const match = LOG_FILE_PATTERN.exec(name);
      if (!match) continue;

      const info = await stat(path.join(dir, name)).catch(() => null);
      if (!info) continue;

      files.push({
        logType,
        name,
        date: match[1],
        index: match[2] ? Number(match[2]) : 0,
        size: info.size,
        mtimeMs: info.mtimeMs,
      });
    }
  }

  return files.sort((left, right) =>
    left.date !== right.date ? (left.date < right.date ? 1 : -1) : right.index - left.index,
  );
}

async function pickFile(options: ReadOptions): Promise<LogFileInfo | null> {
  const files = (await listLogFiles(options)).filter((file) => file.logType === options.logType);
  if (files.length === 0) return null;
  return options.date ? (files.find((file) => file.date === options.date) ?? null) : files[0];
}

/** 顺序读取（cat / admin 分页都走这个） */
export async function* readLogLines(options: ReadOptions): AsyncGenerator<string> {
  const file = await pickFile(options);
  if (!file) return;

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 500;
  let index = 0;
  let yielded = 0;

  for await (const line of readLines(path.join(dirFor(options.dirs, file.logType), file.name))) {
    if (index++ < offset) continue;
    if (!matchLine(line, options.level, options.grep)) continue;

    yield line;
    if (++yielded >= limit) break;
  }
}

/**
 * 实时跟进。不依赖 fs.watch：Windows 上跨天切换 / 大量写入时 watch 会丢事件，
 * 轮询 stat.size 反而最稳，代价是 500ms 的可观测延迟。
 */
export async function* tailLog(options: TailOptions): AsyncGenerator<string> {
  const dir = dirFor(options.dirs, options.logType);
  const readOptions: ReadOptions = { ...options };
  const filter = { level: options.level, grep: options.grep };

  let current = await pickFile(readOptions);
  if (!current) return;

  for (const line of await readLastLines(path.join(dir, current.name), options.lines ?? 100, filter)) yield line;
  if (!options.follow) return;

  const filePath = () => path.join(dir, current ? current.name : "");
  const sizeOf = async () => (await stat(filePath()).catch(() => null))?.size ?? 0;
  let offset = await sizeOf();

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 500));

    const latest = await pickFile(readOptions);
    if (!latest) continue;

    if (latest.name !== current.name) {
      const rest = await readFromOffset(filePath(), offset);
      for (const line of rest.lines) if (matchLine(line, filter.level, filter.grep)) yield line;

      current = latest;
      const fresh = await readFromOffset(filePath(), 0);
      for (const line of fresh.lines) if (matchLine(line, filter.level, filter.grep)) yield line;
      offset = fresh.nextOffset;
      continue;
    }

    const size = await sizeOf();
    if (size < offset) offset = 0;
    if (size === offset) continue;

    const chunk = await readFromOffset(filePath(), offset);
    offset = chunk.nextOffset;
    for (const line of chunk.lines) if (matchLine(line, filter.level, filter.grep)) yield line;
  }
}
