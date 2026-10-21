import fp from "fastify-plugin";
import fastifyRedis from "@fastify/redis";
import { env } from "@/core/env";

async function redisPlugin(fastify: FastifyInstance) {
  // await fastify.register(fastifyRedis, {
  //   url: env.REDIS_URL,
  //   keyPrefix: env.REDIS_PREFIX,
  //   // 连不上时尽快失败，否则 ioredis 会一直重连，启动会卡在 Fastify 的插件超时（默认 10s）
  //   connectTimeout: 5000,
  //   maxRetriesPerRequest: 2,
  //   retryStrategy: (times) => (times > 2 ? null : Math.min(times * 300, 1000)),
  // });
  // try {
  //   await fastify.redis.ping();
  // } catch (error) {
  //   fastify.log.error({ err: error, tip: "无法连接到 Redis 服务器，请检查配置和服务器状态" }, "redis 连接失败");
  //   // 库代码不结束进程，交给 server.ts 统一处理；ioredis 原始错误信息（Connection is closed.）太模糊，补一层上下文
  //   throw new Error("Redis 连接失败，请检查 REDIS_URL 与 Redis 服务状态", { cause: error });
  // }
}

export default fp(redisPlugin, {
  name: "redis",
});
