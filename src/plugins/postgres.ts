import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/core/env";

async function postgresPlugin(fastify: FastifyInstance) {
  const pool = new Pool({
    connectionString: env.APP_DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // 用 pg pool 直接探活：走 drizzle 时底层错误会被包成 "Connection is closed."，
  // 拿不到「database does not exist」这类关键信息。
  try {
    const { rows } = await pool.query<{ db: string }>("SELECT current_database() AS db");
    // 把实际连上的库名打出来：环境变量被同名系统变量覆盖时，这是最快的排错线索
    fastify.log.info({ database: rows[0]?.db }, "postgres 已连接");
  } catch (error) {
    fastify.log.error({ err: error, tip: "连接数据库报错" }, "postgres 连接失败");
    await pool.end();
    throw error;
  }

  const db = drizzle({ client: pool });
  fastify.decorate("db", db);
  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

export default fp(postgresPlugin, { name: "postgres" });
