import { sql } from "drizzle-orm";

export default class GlobalService {
  constructor(private readonly fastify: FastifyInstance) {}
  async health() {
    const redisStatus = await this.fastify.redis.ping();
    await this.fastify.db.execute(sql`SELECT 1`);
    return {
      redis: redisStatus,
      mysql: "ok",
      uptime: Date.now(),
    };
  }
}
