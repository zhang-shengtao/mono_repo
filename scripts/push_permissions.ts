/// <reference types="node" />

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { code } from "../src/db/code";
import { PERMISSION_SEEDS } from "../src/permissions";

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

// 权限码是纯数据：已存在时同步名称/分组/描述，避免改了种子数据却对不上库
await db
  .insert(code)
  .values(rows)
  .onConflictDoUpdate({
    target: code.code,
    set: {
      scope: sql`excluded.scope`,
      name: sql`excluded.name`,
      description: sql`excluded.description`,
    },
  });

await db.$client.end();

console.log(`seed permissions ok: ${rows.length}`);
