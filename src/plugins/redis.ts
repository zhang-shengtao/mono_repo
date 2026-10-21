import fp from "fastify-plugin";
import fastifyRedis from "@fastify/redis";
import { env } from "@/core/env";

async function redisPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRedis, {
    url: env.REDIS_URL,
    keyPrefix: env.REDIS_PREFIX,
  });
  try {
    await fastify.redis.ping();
  } catch (error) {
    fastify.log.error({ tip: "无法连接到 Redis 服务器，请检查配置和服务器状态", error });
    process.exit(1);
  }
}

export default fp(redisPlugin, {
  name: "redis",
});
