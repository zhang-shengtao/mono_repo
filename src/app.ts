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
const projectRootDir = path.dirname(rootDir);
const pluginsDir = path.join(rootDir, "plugins");
const modulesDir = path.join(rootDir, "modules");
const logDir = path.isAbsolute(env.LOG_DIR) ? env.LOG_DIR : path.join(projectRootDir, env.LOG_DIR);

export async function buildApp() {
  const app = Fastify({
    bodyLimit: env.BODY_LIMIT,
    trustProxy: env.TRUST_PROXY,
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
