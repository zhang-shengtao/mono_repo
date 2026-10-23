/**
 * 主进程 ↔ 子进程的控制面协议。
 *
 * 数据面（日志行走 stdin，NDJSON）与控制面严格分离：把控制消息混进 stdin，
 * 写盘器就得区分两种行，任何解析错误都会污染日志文件。
 *
 * 改动 stdin 的行格式或这里任意消息结构时，必须同步 bump PROTOCOL_VERSION。
 */
export const PROTOCOL_VERSION = 1;

export type ParentMessage =
  /** 探活 */
  | { v: 1; type: "ping" }
  /** 请求上报统计 */
  | { v: 1; type: "stats" }
  /** 手动切分当前文件（调试用） */
  | { v: 1; type: "rotate" }
  /** 请求把缓冲刷到磁盘并回执 */
  | { v: 1; type: "drain" };

export interface RetentionReport {
  ranAt: number;
  removed: number;
  skipped: number;
  cutoff: string;
}

export type ChildMessage =
  | { v: 1; type: "ready"; pid: number }
  | {
      v: 1;
      type: "stats";
      written: number;
      failedWrites: number;
      /** JSON.parse 失败被丢弃的行数（说明上下游格式不一致） */
      malformed: number;
      files: string[];
      retention: RetentionReport | null;
    }
  | { v: 1; type: "drained" }
  | { v: 1; type: "error"; code: "ENOSPC" | "EACCES" | "EPIPE" | "OTHER"; message: string }
  | { v: 1; type: "bye"; written: number; failedWrites: number };

export function isParentMessage(value: unknown): value is ParentMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as { v?: unknown; type?: unknown };
  if (message.v !== PROTOCOL_VERSION) return false;
  return message.type === "ping" || message.type === "stats" || message.type === "rotate" || message.type === "drain";
}
