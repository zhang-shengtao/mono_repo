import fp from "fastify-plugin";
import fastifyRedis from "@fastify/redis";
import { env } from "@/core/env";

/**
 * 启动阶段的重试上限：第 3 次连接失败就放弃（对应 ioredis 的 times > 2 → null）。
 *
 * @fastify/redis 只在 `ready` 或 `end` 事件上 resolve/reject；而 retryStrategy 一旦永远返回数字，
 * ioredis 就永远不会 end，启动会一直挂到 Fastify 的插件超时，报错还变成难读的
 * `Plugin did not start in time: '@fastify/redis'`。所以启动阶段必须「有限」重试。
 */
const STARTUP_RETRY_LIMIT = 2;

async function redisPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyRedis, {
    url: env.REDIS_URL,
    keyPrefix: env.REDIS_PREFIX,
    // 单次连接最多等 5s，避免地址不可达时启动长时间无响应
    connectTimeout: 5000,
    // 连接不可用期间，排队中的命令会在第 maxRetriesPerRequest + 1 次重连失败时被整体 reject，
    // 避免请求无限挂起
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => (times > STARTUP_RETRY_LIMIT ? null : Math.min(times * 500, 1000)),
  });

  try {
    await fastify.redis.ping();
  } catch (error) {
    fastify.log.error({ err: error, tip: "无法连接到 Redis 服务器，请检查配置和服务器状态" }, "redis 连接失败");
    // 库代码不结束进程，交给 server.ts 统一处理；ioredis 原始错误信息（Connection is closed.）太模糊，补一层上下文
    throw new Error("Redis 连接失败，请检查 REDIS_URL 与 Redis 服务状态", { cause: error });
  }

  /**
   * 启动成功后切换成「永不放弃」的重连策略（退避上限 3s）。
   *
   * 上面那套有限重试只适合启动阶段：如果运行期也用它，Redis 只要重启一次（或主从切换、网络抖动），
   * 客户端就会停在第 3 次失败并长期握着死连接，之后所有需要登录态的请求全部 500，
   * 只能重启应用才能恢复 —— 这比启动失败更难排查。
   * 这里直接改 ioredis 的 options：它的 closeHandler 每次断线都会重新读这个函数，所以会立即生效。
   */
  fastify.redis.options.retryStrategy = (times) => Math.min(times * 500, 3000);
}

export default fp(redisPlugin, {
  name: "redis",
});
