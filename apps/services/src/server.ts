import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeError } from "@/core/app-error";
import { findPackageRoot } from "@/core/paths";


async function main() {
  try {
    const { env } = await import("./core/env");
    const { buildApp } = await import("./app");
    const { setupLogger } = await import("@repo/logger");
    const baseDir = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
    const { logger, config, shutdown } = setupLogger({
      baseDir,
      service: process.env.LOG_SERVICE || undefined,
    });
    const app = await buildApp({ logger });
    let stopping = false;
    async function stop(exitCode: number): Promise<void> {
      if (stopping) return;
      stopping = true;
      await new Promise<void>((resolve) => shutdown(resolve));
      process.exit(exitCode);
    }
    try {
      await app.listen({
        host: env.HOST,
        port: env.PORT,
      });
      logger.info(`服务已启动：http://localhost:${env.PORT}`);
      console.log(
        `[server] 已启动 http://localhost:${env.PORT}` +
          `（日志：${config.logDir}，模式：${config.mode}，保留：${config.retentionDays} 天，单文件：${config.maxFileMb}MB）`,
      );
    } catch (error) {
      logger.error({ err: error }, "服务启动失败");
      await stop(1);
    }
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        logger.info({ signal }, "收到退出信号，开始优雅关闭");
        app
          .close()
          .then(() => stop(0))
          .catch(async (error: unknown) => {
            logger.error({ err: error }, "优雅关闭失败");
            await stop(1);
          });
      });
    }
  } catch (error) {
    console.error("[server] 启动失败：", describeError(error));
    process.exit(1);
  }
}

await main();
