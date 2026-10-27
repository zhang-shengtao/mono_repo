import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import autoLoad from "@fastify/autoload";
import type { RepoLogger } from "@repo/logger";
import Fastify, { LogController, type FastifyBaseLogger } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "@/core/env";
import { registerErrorHandler } from "@/core/error_handler";
import { registerResponse } from "@/core/response";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(currentFilePath);
const pluginsDir = path.join(rootDir, "plugins");
const modulesDir = path.join(rootDir, "modules");

export interface BuildAppOptions {
  logger: RepoLogger;
}

export async function buildApp(options: BuildAppOptions) {
  const fastifyLogger: FastifyBaseLogger = options.logger;
  const app = Fastify({
    bodyLimit: env.BODY_LIMIT,
    trustProxy: env.TRUST_PROXY,
    pluginTimeout: 30000,
    loggerInstance: fastifyLogger,
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
