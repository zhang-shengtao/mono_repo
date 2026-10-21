/// <reference types="node" />

import { drizzle } from "drizzle-orm/mysql2";
import { code } from "../src/db/code";
import { PERMISSION_SEEDS } from "../src/permissions/index";

const mysqlUrl = process.env.MYSQL_URL;

if (!mysqlUrl) {
  throw new Error("MYSQL_URL is required");
}

const db = drizzle(mysqlUrl);

const rows: Array<typeof code.$inferInsert> = PERMISSION_SEEDS.map((item) => ({
  code: item.code,
  scope: item.scope,
  name: item.name,
  description: item.description,
}));

await db.insert(code).ignore().values(rows);

await new Promise<void>((resolve, reject) => {
  db.$client.end((error) => {
    if (error) reject(error);
    else resolve();
  });
});

console.log(`seed permissions ok: ${rows.length}`);
