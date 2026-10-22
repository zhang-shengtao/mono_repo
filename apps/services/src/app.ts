import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import autoLoad from "@fastify/autoload";
import Fastify, { LogController } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { formatLogTime } from "@/utils";
import { env } from "@/core/env";
import { registerErrorHandler } from "@/core/error-handler";
import { registerResponse } from "@/core/response";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(currentFilePath);
/**
 * 源码和构建产物都嵌在包根里（dev: apps/services/src、build: apps/services/dist），所以包根是上一级。
 * 但 dist 被单独拷到服务器当部署目录时，它自己就是包根 —— 这时日志不能写到部署目录的上一级去。
 */
const projectRootDir = isNestedInPackage(rootDir) ? path.dirname(rootDir) : rootDir;
const pluginsDir = path.join(rootDir, "plugins");
const modulesDir = path.join(rootDir, "modules");
const logDir = path.isAbsolute(env.LOG_DIR) ? env.LOG_DIR : path.join(projectRootDir, env.LOG_DIR);

function isNestedInPackage(dir: string) {
  const baseName = path.basename(dir);
  return baseName === "src" || baseName === "dist";
}

export async function buildApp() {
  const app = Fastify({
    bodyLimit: env.BODY_LIMIT,
    trustProxy: env.TRUST_PROXY,
    /**
     * 插件默认 10s 超时。Redis 探活失败要经历 3 次连接尝试（每次 connectTimeout 最长 5s），
     * 地址被防火墙黑洞时约 18s，会先撞上 10s 的插件超时，日志里就只剩 AVV_ERR_PLUGIN_TIMEOUT，
     * 看不到 redis.ts 里那条带上下文的中文错误。这里放宽到 30s，保证启动失败时的第一现场是友好的。
     */
    pluginTimeout: 30000,
    logger: {
      level: env.LOG_LEVEL,
      base: undefined,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: () => `,"time":"${formatLogTime()}"`,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "headers.authorization",
          "headers.cookie",
          'headers["set-cookie"]',
          "body.password",
          "body.newPassword",
          "body.token",
        ],
        remove: false,
      },
      transport: {
        target: path.join(rootDir, "core", "access-log-transport.mjs"),
        options: {
          logDir,
        },
      },
    },
    logController: new LogController({
      disableRequestLogging: true,
    }),
    genReqId: () => randomUUID(),
  });
  app.withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerResponse(app);
  registerErrorHandler(app);
  await app.register(autoLoad, {
    dir: pluginsDir,
    scriptPattern: /.*\.(js|ts)$/,
  });
  await app.register(autoLoad, {
    dir: modulesDir,
    dirNameRoutePrefix: false,
    scriptPattern: /.*\.route\.(js|ts)$/,
  });
  return app;
}
