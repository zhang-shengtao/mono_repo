
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
