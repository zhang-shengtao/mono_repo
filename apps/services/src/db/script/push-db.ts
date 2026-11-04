import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";

const PUSH_LOCK_KEY = "drizzle:push";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required（drizzle-kit push 要连库做 schema diff）");
}

const extraArgs = process.argv.slice(2);
const configArgs = resolveConfigArgs();
const db = drizzle(databaseUrl);

const lockClient = await db.$client.connect();

try {
  await lockClient.query("select pg_advisory_lock(hashtext($1))", [PUSH_LOCK_KEY]);

  const result = spawnSync(process.execPath, [resolveDrizzleKitBin(), "push", ...configArgs, ...extraArgs], {
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await lockClient.query("select pg_advisory_unlock(hashtext($1))", [PUSH_LOCK_KEY]).catch(() => {});
  lockClient.release();
  await db.$client.end();
}

function resolveDrizzleKitBin() {
  const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("drizzle-kit")));
  return path.join(packageRoot, "bin.cjs");
}

function resolveConfigArgs() {
  for (const file of ["drizzle.config.mjs", "drizzle.config.ts"]) {
    if (existsSync(path.join(process.cwd(), file))) return ["--config", file];
  }

  throw new Error("找不到 drizzle 配置（drizzle.config.ts / drizzle.config.mjs）");
}
