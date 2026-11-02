import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { code } from "@/db/code";
import { PERMISSION_SEEDS } from "@/permissions";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required");
}

const db = drizzle(databaseUrl);

const rows: Array<typeof code.$inferInsert> = PERMISSION_SEEDS.map((item) => ({
  code: item.code,
  scope: item.scope,
  name: item.name,
  description: item.description,
}));

await db
  .insert(code)
  .values(rows)
  .onConflictDoUpdate({
    target: code.code,
    set: {
      scope: sql`excluded.scope`,
      name: sql`excluded.name`,
      // 备注是权限码管理页上人工维护的字段：种子只在库里还空着时才补默认值，
      // 否则每次 dev 启动（dev 脚本会跑本种子）都会把管理员改过的备注冲掉
      description: sql`coalesce(${code.description}, excluded.description)`,
    },
  });

await db.$client.end();

console.log(`seed permissions ok: ${rows.length}`);
