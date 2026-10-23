/**
 * 一行接入：读配置 → 建 sink（child / off）→ 建 logger。
 * 框架无关（Fastify / Express / worker / 脚本都能用），这就是"通用包"的落点。
 *
 * 用法：
 *   const { logger, config, shutdown } = setupLogger({ service: "order", baseDir: process.cwd() });
 */
import { onceWithTimeout } from "./async.js";
import { loadLogConfig, type LoadLogConfigOptions, type LogConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createOffSink } from "./off-sink.js";
import { createChildSink } from "./sink.js";
import type { LogSink, RepoLogger } from "./types.js";

export interface ServiceLoggerOptions extends LoadLogConfigOptions {
  env?: NodeJS.ProcessEnv;
  /** 额外固定字段，如 { version: "1.2.0" } */
  base?: Record<string, unknown>;
}

export interface ServiceLogger {
  logger: RepoLogger;
  sink: LogSink;
  config: LogConfig;
  /** 退出前调用：排空队列 + 关闭子进程；5s 硬超时，不会卡住停机 */
  shutdown(cb?: () => void): void;
}

/** LOG_STDOUT=true 时同时打到 stdout（容器/调试场景） */
function teeToStdout(sink: LogSink): LogSink {
  return {
    write(line) {
      process.stdout.write(`${line}\n`);
      sink.write(line);
    },
    flush: (cb) => sink.flush(cb),
    end: (cb) => sink.end(cb),
    stats: () => sink.stats(),
  };
}

export function setupLogger(options: ServiceLoggerOptions): ServiceLogger {
  const env = options.env ?? process.env;
  const config = loadLogConfig(env, options);

  let sink: LogSink = config.mode === "off" ? createOffSink() : createChildSink(config);
  if (config.mode !== "off") (sink as LogSink & { start(): void }).start();
  if (config.stdout) sink = teeToStdout(sink);

  const logger = createLogger({
    level: config.level,
    base: { ...(config.service ? { service: config.service } : {}), pid: process.pid, ...options.base },
    sink,
  });

  return {
    logger,
    sink,
    config,
    shutdown(cb) {
      void onceWithTimeout((done) => sink.end(done), 5000).then(() => cb?.());
    },
  };
}
