import fp from "fastify-plugin";
import fastifyRedis from "@fastify/redis";
import { env } from "@/core/env";


const STARTUP_RETRY_LIMIT = 2;

async function redisPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRedis, {
    url: env.REDIS_URL,
    keyPrefix: env.REDIS_PREFIX,
    connectTimeout: 5000,
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => (times > STARTUP_RETRY_LIMIT ? null : Math.min(times * 500, 1000)),
  });

  try {
    await fastify.redis.ping();
  } catch (error) {
    fastify.log.error({ err: error, tip: "无法连接到 Redis 服务器，请检查配置和服务器状态" }, "redis 连接失败");
    throw new Error("Redis 连接失败，请检查 REDIS_URL 与 Redis 服务状态", { cause: error });
  }
  fastify.redis.options.retryStrategy = (times) => Math.min(times * 500, 3000);
}

export default fp(redisPlugin, {
  name: "redis",
});
