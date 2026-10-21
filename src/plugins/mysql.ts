import fp from "fastify-plugin";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { env } from "@/core/env";

async function mysqlPlugin(fastify: FastifyInstance) {
  const pool = createPool(env.MYSQL_URL);
  const db = drizzle({ client: pool });
  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    fastify.log.error({ tip: "链接数据库报错", error });
    await pool.end();
    throw error;
  }

  fastify.decorate("db", db);
  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

export default fp(mysqlPlugin, { name: "mysql" });
