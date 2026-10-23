/**
 * logger facade —— 只做四件事：判级、拼 level/ts、序列化业务字段、交给 sink。
 *
 * 边界（不要往回加功能）：
 * - 不脱敏：脱敏在子进程做，配置驱动；
 * - 不格式化 time：只发 ts（epoch ms），time 由子进程从 ts 生成；
 * - 不碰文件、不决定目录 / 切分 / 保留。
 *
 * 硬约束：child() 必须 O(1)（Fastify 每个请求都调一次）；整条路径永不抛、永不阻塞。
 */
import { resolveLevel } from "./level.js";
import { isRecord, jsonInner } from "./object.js";
import {
  LEVEL_VALUES,
  type ChildLoggerOptions,
  type LogFn,
  type LogLevel,
  type LogLevelName,
  type LogSink,
  type RepoLogger,
} from "./types.js";

export interface LoggerOptions {
  level?: LogLevelName;
  /** 固定字段，例如 { service: "order", pid: 1234 } */
  base?: Record<string, unknown>;
  sink: LogSink;
  /** 便于测试注入时间 */
  now?: () => number;
}

interface LoggerState {
  sink: LogSink;
  /** 已序列化的 bindings（不含花括号），例如 `"service":"order","pid":1234` */
  prefix: string;
  levelName: LogLevelName;
  levelValue: number;
  now: () => number;
}

function parseArgs(obj: unknown, msg: string | undefined): { merge?: unknown; message?: string } {
  if (typeof obj === "string") return { message: obj };
  if (obj === undefined || obj === null) return { message: msg };
  if (typeof obj === "object") return { merge: obj, message: msg };
  return { message: msg ?? String(obj) };
}

function writeRecord(state: LoggerState, levelName: LogLevel, obj: unknown, msg: string | undefined): void {
  try {
    const ts = state.now();
    const parts: string[] = [`{"level":"${levelName}","ts":${ts}`];
    if (state.prefix) parts.push(`,${state.prefix}`);

    const { merge, message } = parseArgs(obj, msg);
    if (merge !== undefined) {
      const payload = jsonInner(merge);
      if (payload) parts.push(`,${payload}`);
    }
    if (message !== undefined && message !== "") parts.push(`,"msg":${JSON.stringify(message)}`);
    parts.push("}");

    state.sink.write(parts.join(""));
  } catch {}
}

function buildLogger(state: LoggerState): RepoLogger {
  const makeLogFn = (levelName: LogLevel): LogFn => {
    const levelValue = LEVEL_VALUES[levelName];
    return (obj?: unknown, msg?: string) => {
      if (state.levelValue > levelValue) return;
      writeRecord(state, levelName, obj, msg);
    };
  };

  const child = (
    bindings?: Record<string, unknown>,
    options?: ChildLoggerOptions | Record<string, unknown>,
  ): RepoLogger => {
    const bindingsText = jsonInner(bindings);
    const prefix = bindingsText ? (state.prefix ? `${state.prefix},${bindingsText}` : bindingsText) : state.prefix;

    const wanted = isRecord(options) ? options.level : undefined;
    const normalized = resolveLevel(wanted, { name: state.levelName, value: state.levelValue });

    return buildLogger({ ...state, prefix, levelName: normalized.name, levelValue: normalized.value });
  };

  return {
    get level() {
      return state.levelName;
    },
    set level(next: LogLevelName) {
      const normalized = resolveLevel(next, { name: state.levelName, value: state.levelValue });
      state.levelName = normalized.name;
      state.levelValue = normalized.value;
    },
    trace: makeLogFn("trace"),
    debug: makeLogFn("debug"),
    info: makeLogFn("info"),
    warn: makeLogFn("warn"),
    error: makeLogFn("error"),
    fatal: makeLogFn("fatal"),
    silent: () => {},
    child,
    isLevelEnabled(level: LogLevelName) {
      if (level === "silent") return false;
      return LEVEL_VALUES[level] >= state.levelValue;
    },
    flush(cb) {
      state.sink.flush(cb);
    },
  };
}

export function createLogger(options: LoggerOptions): RepoLogger {
  const normalized = resolveLevel(options.level ?? "info", { name: "info", value: LEVEL_VALUES.info });
  return buildLogger({
    sink: options.sink,
    prefix: jsonInner(options.base),
    levelName: normalized.name,
    levelValue: normalized.value,
    now: options.now ?? (() => Date.now()),
  });
}
