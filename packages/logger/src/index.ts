/**
 * @repo/logger 对外入口。
 *
 * 微服务（任意框架）一行接入：
 *   const { logger, config, shutdown } = setupLogger({ service: "order", baseDir: process.cwd() });
 *
 * 只要 facade / 自己管 sink：
 *   const logger = createLogger({ level, base, sink: createChildSink(config) });
 *
 * 内部模块（line / level / file-read / child-process / async）不从这里导出，
 * 保持公开 API 面最小。
 */
export { createLogger, type LoggerOptions } from "./logger.js";
export { setupLogger, type ServiceLogger, type ServiceLoggerOptions } from "./setup.js";
export {
  dirFor,
  loadLogConfig,
  resolveLogDirs,
  resolveSanitizeLimits,
  type LoadLogConfigOptions,
  type LogConfig,
  type LogDirs,
  type LogMode,
} from "./config.js";
export { createChildSink, type ChildSinkOptions } from "./sink.js";
export { createOffSink } from "./off-sink.js";
export { sanitize, type SanitizeOptions, type SanitizeResult } from "./sanitize.js";
export { createRedactor, DEFAULT_REDACT_PATHS, type Redactor } from "./redact.js";
export { createRecordTransform, type TransformOptions, type TransformResult } from "./transform.js";
export { LogWriter, type WriteHint, type WriterOptions } from "./writer.js";
export { runRetention, type RetentionOptions, type RetentionResult } from "./retention.js";
export { dayOfEpoch, formatLogTime, isIsoDate, shiftDays, ymd } from "./time.js";
export {
  LEVEL_VALUES,
  LOG_LEVELS,
  type ChildLoggerOptions,
  type LogDirKey,
  type LogFn,
  type LogLevel,
  type LogLevelName,
  type LogSink,
  type RepoLogger,
  type SinkMode,
  type SinkState,
  type SinkStats,
} from "./types.js";
export { PROTOCOL_VERSION, type ChildMessage, type ParentMessage, type RetentionReport } from "./protocol.js";
