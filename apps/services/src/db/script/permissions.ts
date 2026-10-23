/**
 * 权限码种子：把 src/permissions 里的常量同步进 code 表。
 *
 * 为什么放在 src/ 而不是 scripts/：
 *   scripts/ 不在 tsconfig 的 include 范围里（rootDir 是 src），编译不进 dist，只能靠 tsx 直跑；
 *   而这段逻辑只依赖 drizzle-orm / pg 这些「运行时依赖」，放进 src 就能一起编进 dist ——
 *   生产环境直接 `node dist/db/script/permissions.js`，既不需要 tsx，也不需要源码。
 *
 * 用法（源码态和 dist 同名）：pnpm --filter @repo/services db:seed:permissions
 */
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
      description: sql`excluded.description`,
    },
  });

await db.$client.end();

console.log(`seed permissions ok: ${rows.length}`);
