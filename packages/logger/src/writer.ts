/**
 * 写盘器：按 logType 分目录、按天切文件、可选按大小切分。
 * 只关心「写到哪个文件」；行头解析在 line.ts，超时收尾在 async.ts。
 *
 * 背压约定：write() 返回 false 表示底层文件流已满，调用方应停止投喂
 * （子进程 pause stdin），等 'drain' 事件后继续。
 */
import { EventEmitter } from "node:events";
import { createWriteStream, existsSync, mkdirSync, statSync, type WriteStream } from "node:fs";
import path from "node:path";
import { onceWithTimeout } from "./async.js";
import { dirFor, type LogDirs } from "./config.js";
import { peekHeader } from "./line.js";
import { dayOfEpoch } from "./time.js";
import type { LogDirKey } from "./types.js";

export interface WriterErrorInfo {
  error: Error;
  code?: string;
  dirKey: LogDirKey;
  filePath?: string;
}

export interface WriterOptions {
  dirs: LogDirs;
  /** 单文件上限（MB）；<= 0 表示不切分 */
  maxFileMb?: number;
  onError?: (info: WriterErrorInfo) => void;
}

export interface WriterStats {
  written: number;
  failedWrites: number;
  files: string[];
}

/** 写盘位置提示：子进程已解析过记录，别再解析第二遍 */
export interface WriteHint {
  ts: number;
  dirKey: LogDirKey;
}

interface StreamEntry {
  date: string;
  index: number;
  filePath: string;
  stream: WriteStream;
  /** 已写入该文件的字节数（含进程启动前就存在的部分） */
  size: number;
}

export class LogWriter extends EventEmitter {
  private readonly dirs: LogDirs;
  private readonly maxBytes: number;
  private readonly onError: ((info: WriterErrorInfo) => void) | undefined;
  private readonly entries = new Map<LogDirKey, StreamEntry>();
  private written = 0;
  private failedWrites = 0;
  private closed = false;

  constructor(options: WriterOptions) {
    super();
    this.dirs = options.dirs;
    this.maxBytes = (options.maxFileMb ?? 0) * 1024 * 1024;
    this.onError = options.onError;
  }

  write(line: string, hint?: WriteHint): boolean {
    if (this.closed) return true;

    try {
      const target = hint ?? peekHeader(line);
      const date = dayOfEpoch(target.ts);
      const bytes = Buffer.byteLength(line, "utf8") + 1;
      let entry = this.entries.get(target.dirKey);

      if (!entry || entry.date !== date) {
        entry?.stream.end();
        entry = this.open(target.dirKey, date, 0);
        this.entries.set(target.dirKey, entry);
      } else if (this.maxBytes > 0 && entry.size > 0 && entry.size + bytes > this.maxBytes) {
        entry.stream.end();
        entry = this.open(target.dirKey, date, entry.index + 1);
        this.entries.set(target.dirKey, entry);
      }

      entry.size += bytes;
      this.written++;
      return entry.stream.write(`${line}\n`, "utf8");
    } catch (error) {
      this.failedWrites++;
      this.onError?.({ error: error as Error, dirKey: "log" });
      return true;
    }
  }

  /** 立即结束当前文件流，下次写入重新打开（调试 / 手动切分用） */
  rotateNow(): void {
    for (const [dirKey, entry] of this.entries) {
      entry.stream.end();
      this.entries.delete(dirKey);
    }
  }

  files(): string[] {
    return [...this.entries.values()].map((entry) => entry.filePath);
  }

  stats(): WriterStats {
    return { written: this.written, failedWrites: this.failedWrites, files: this.files() };
  }

  close(cb?: () => void): void {
    this.closed = true;
    const entries = [...this.entries.values()];
    this.entries.clear();
    if (entries.length === 0) {
      cb?.();
      return;
    }

    void onceWithTimeout((done) => {
      let pending = entries.length;
      for (const entry of entries) {
        entry.stream.end(() => {
          if (--pending === 0) done();
        });
      }
    }, 3000).then(() => cb?.());
  }

  private open(dirKey: LogDirKey, date: string, index: number): StreamEntry {
    const dir = dirFor(this.dirs, dirKey);
    mkdirSync(dir, { recursive: true });

    let candidateIndex = index;
    let candidatePath = this.filePath(dir, date, candidateIndex);
    while (this.maxBytes > 0 && existsSync(candidatePath) && this.sizeOf(candidatePath) >= this.maxBytes) {
      candidateIndex++;
      candidatePath = this.filePath(dir, date, candidateIndex);
    }

    const size = this.sizeOf(candidatePath);
    const stream = createWriteStream(candidatePath, { flags: "a", encoding: "utf8" });

    stream.on("error", (error: NodeJS.ErrnoException) => {
      this.failedWrites++;
      this.onError?.({ error, code: error.code, dirKey, filePath: candidatePath });
    });
    stream.on("drain", () => this.emit("drain"));

    return { date, index: candidateIndex, filePath: candidatePath, stream, size };
  }

  private filePath(dir: string, date: string, index: number): string {
    return path.join(dir, index === 0 ? `${date}.log` : `${date}.${index}.log`);
  }

  private sizeOf(filePath: string): number {
    try {
      return statSync(filePath).size;
    } catch {
      return 0;
    }
  }
}
