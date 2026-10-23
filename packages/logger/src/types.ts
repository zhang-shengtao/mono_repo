/**
 * 日志包的类型契约。
 *
 * 这个包要同时跑在主进程（facade）和子进程（写盘），而且要被多个微服务复用，
 * 所以这里刻意不依赖任何第三方包，也不 import 任何框架类型。
 */

/** 级别 → 数值。数值越大越严重，过滤就是比较大小。 */
export const LEVEL_VALUES = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

export type LogLevel = keyof typeof LEVEL_VALUES;
export type LogLevelName = LogLevel | "silent";

/** 供 CLI / 测试遍历用（对象的 key 顺序在部分工具里不稳定） */
export const LOG_LEVELS: readonly LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];

/** 日志分目录用的逻辑类型 */
export type LogDirKey = "router" | "log";

/**
 * 与 pino 一致的调用签名：`(mergeObject, msg)` 或 `(msg)`。
 * 额外参数被忽略——本包不做 printf 格式化，避免行为歧义。
 */
export type LogFn = (obj: unknown, msg?: string, ...args: unknown[]) => void;

export interface ChildLoggerOptions {
  level?: LogLevelName;
}

/** Fastify 需要的最小 facade 契约（fastify/types/logger.d.ts:27） */
export interface RepoLogger {
  /** 可读可写：`logger.level = "debug"` 运行时热改 */
  level: LogLevelName;
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  /** Fastify 的 FastifyBaseLogger 要求有这个成员 */
  silent: LogFn;
  child(bindings?: Record<string, unknown>, options?: ChildLoggerOptions | Record<string, unknown>): RepoLogger;
  isLevelEnabled(level: LogLevelName): boolean;
  /** 排空队列（退出前调用），不负责关闭子进程 */
  flush(cb?: (err?: Error) => void): void;
}

export type SinkMode = "child" | "off";

/**
 * sink 状态机：
 * - starting 已 spawn 未就绪
 * - ready    子进程在线
 * - restart  子进程退出，等待重启（没有降级，永久重试）
 * - stopped  已关闭
 */
export type SinkState = "starting" | "ready" | "restart" | "stopped";

export interface SinkStats {
  mode: SinkMode;
  state: SinkState;
  /** 交给 sink 的行数（不是落盘行数） */
  written: number;
  /** 因队列水位被丢弃的行数 */
  dropped: number;
  restarts: number;
  childPid?: number;
  lastError?: string;
}

/** 主服务只依赖这个接口；以后加 stdout / OTLP 传输就是再加一个实现 */
export interface LogSink {
  write(line: string): void;
  flush(cb?: (err?: Error) => void): void;
  end(cb?: (err?: Error) => void): void;
  stats(): SinkStats;
}
