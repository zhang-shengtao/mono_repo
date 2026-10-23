/**
 * 配置解析：让每个微服务只写一行 setupLogger({ service })，不用各抄一份 env schema。
 * 刻意不用 zod —— 本包要保持零运行时依赖；非法值回落默认，由调用方自己决定要不要提示。
 */
import path from "node:path";
import type { LogDirKey, LogLevelName } from "./types.js";

export type LogMode = "child" | "off";

export interface LogConfig {
  /** 服务名：写进每条日志 + 决定日志子目录；不给则沿用旧布局 */
  service: string | undefined;
  level: LogLevelName;
  mode: LogMode;
  /** 绝对路径 */
  logDir: string;
  retentionDays: number;
  maxFileMb: number;
  /** 主进程净化上限：单个字符串长度（用 length 近似字节）/ 遍历节点数 */
  bodyMaxBytes: number;
  bodyMaxNodes: number;
  /** 逗号分隔，传给子进程做脱敏 */
  redactPaths: string;
  redactCensor: string;
  maxBufferBytes: number;
  stdout: boolean;
  timezone: string;
}

export interface LogDirs {
  root: string;
  router: string;
  log: string;
}

export interface LoadLogConfigOptions {
  /** 服务名，写进日志与目录 */
  service?: string;
  /** 环境变量前缀，默认 LOG_；同机多服务可用 ORDER_LOG_ / USER_LOG_ 各配各的 */
  envPrefix?: string;
  /** logDir 相对路径的基准目录（一般是包根） */
  baseDir: string;
}

const LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function readNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const parsed = Number(env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 主进程净化上限（与 loadLogConfig 同源）。
 * 单独导出，让"不经过 setupLogger"的服务（比如只拿 logger facade 的微服务）
 * 也能读到同一份配置，而不是各抄一个默认值。
 */
export function resolveSanitizeLimits(
  env: NodeJS.ProcessEnv = process.env,
  prefix = "LOG_",
): { maxStringBytes: number; maxNodes: number } {
  return {
    maxStringBytes: readNumber(env, `${prefix}BODY_MAX_BYTES`, 16 * 1024),
    maxNodes: readNumber(env, `${prefix}BODY_MAX_NODES`, 2000),
  };
}

export function loadLogConfig(env: NodeJS.ProcessEnv, options: LoadLogConfigOptions): LogConfig {
  const prefix = options.envPrefix ?? "LOG_";
  const read = (key: string): string | undefined => env[`${prefix}${key}`];

  const rawDir = read("DIR") ?? "logs";
  const rawLevel = read("LEVEL") ?? "info";
  const limits = resolveSanitizeLimits(env, prefix);

  return {
    service: options.service,
    level: (LEVELS.has(rawLevel) ? rawLevel : "info") as LogLevelName,
    mode: read("MODE") === "off" ? "off" : "child",
    logDir: path.isAbsolute(rawDir) ? rawDir : path.join(options.baseDir, rawDir),
    retentionDays: readNumber(env, `${prefix}RETENTION_DAYS`, 30),
    maxFileMb: readNumber(env, `${prefix}MAX_FILE_MB`, 10),
    bodyMaxBytes: limits.maxStringBytes,
    bodyMaxNodes: limits.maxNodes,
    redactPaths: read("REDACT_PATHS") ?? "",
    redactCensor: read("REDACT_CENSOR") ?? "[Redacted]",
    maxBufferBytes: readNumber(env, `${prefix}SINK_MAX_BUFFER_MB`, 4) * 1024 * 1024,
    stdout: read("STDOUT") === "true",
    timezone: env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  };
}

/**
 * 目录推导的唯一出处（writer / retention / viewer 都用它）。
 * 设了 service 就多一层子目录：多服务共用一个 LOG_DIR 时文件不混、保留策略不互删。
 */
export function resolveLogDirs(config: Pick<LogConfig, "logDir" | "service">): LogDirs {
  const root = config.service ? path.join(config.logDir, config.service) : config.logDir;
  return { root, router: path.join(root, "router"), log: path.join(root, "log") };
}

/** 取某个逻辑类型对应的目录 */
export function dirFor(dirs: LogDirs, key: LogDirKey): string {
  return key === "router" ? dirs.router : dirs.log;
}
