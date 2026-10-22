import { describeError } from "@/core/app-error";

/**
 * 启动流程集中在 main 里。
 *
 * app / env 用动态 import 引入，是因为 src/core/env.ts 在「模块求值阶段」就会做环境变量校验并抛错：
 * 如果写成静态 import，错误发生在 import 生效之前，这里的 try/catch 根本捕获不到，
 * 启动失败就只能看到一大段 Zod 堆栈。
 */
async function main() {
  try {
    const { buildApp } = await import("./app");
    const { env } = await import("./core/env");
    const app = await buildApp();

    /**
     * pino 的 transport 跑在 worker 线程里，直接 process.exit 会丢掉缓冲区中尚未落盘的日志，
     * 退出前必须 flush 一次（最多等 2s，避免异常情况下进程卡死）。
     * Fastify 的 FastifyBaseLogger 类型没有暴露 flush，实际运行时是 pino 实例。
     */
    async function shutdown(exitCode: number) {
      const logger = app.log as unknown as { flush?: (callback?: () => void) => void };
      await Promise.race([
        new Promise<void>((resolve) => {
          if (typeof logger.flush === "function") logger.flush(() => resolve());
          else resolve();
        }),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2000);
        }),
      ]);
      process.exit(exitCode);
    }

    try {
      await app.listen({
        host: env.HOST,
        port: env.PORT,
      });
      app.log.info(`服务已启动：http://localhost:${env.PORT}`);
      // pino 的日志走自定义 transport 只写文件，控制台默认是空的；
      // 这里补一行 stdout，避免 npm run dev 时「看起来没启动」。
      console.log(`[server] 已启动 http://localhost:${env.PORT}（日志目录：${env.LOG_DIR}）`);
    } catch (error) {
      app.log.error({ err: error }, "服务启动失败");
      await shutdown(1);
    }

    // 优雅停机：容器/进程管理器发送 SIGTERM 时先关闭连接池与长连接
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        app.log.info({ signal }, "收到退出信号，开始优雅关闭");
        app
          .close()
          .then(() => shutdown(0))
          .catch(async (error: unknown) => {
            app.log.error({ err: error }, "优雅关闭失败");
            await shutdown(1);
          });
      });
    }
  } catch (error) {
    console.error("[server] 启动失败：", describeError(error));
    process.exit(1);
  }
}

await main();
