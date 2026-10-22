/**
 * `db:push` 的实际执行器：包一层 `drizzle-kit push`（schema ↔ 活库 diff，然后直接执行 DDL）。
 *
 * 为什么不直接在 package.json 里写 `drizzle-kit push`：
 *   1. **二进制位置**：仓库里 drizzle-kit 装在 `apps/services/node_modules`，产物里装在 `dist/node_modules`，
 *      这里用 `import.meta.resolve` 让 Node 自己往上找，两份脚本一个字都不用改；
 *   2. **并发**：pm2 cluster / 滚动发布时多个进程会同时 push、互相撞 DDL ——
 *      先用库级 advisory lock 串行化：先到的 diff 完，后到的拿到锁时结构已一致，直接「无变更」退出；
 *   3. **退出码**：push 失败就把非 0 透传给 npm，dist 的 `prestart` 因此不会把服务拉起来。
 *
 * 两边同名同语义，只差 env 文件前缀：
 *   仓库：pnpm db:push    → node --env-file=.env --import tsx src/db/script/push-db.ts
 *   dist：npm run db:push → node --env-file-if-exists=.env db/script/push-db.js
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";

/** 库级 advisory lock 的键：同一个库上的并发 push 靠它串行化 */
const PUSH_LOCK_KEY = "drizzle:push";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required（drizzle-kit push 要连库做 schema diff）");
}

/** 额外参数原样透传，例如 `pnpm db:push -- --force` / `--verbose` */
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

/**
 * drizzle-kit 的 `exports` 只暴露了 `.` 和 `./api`，`require.resolve("drizzle-kit/bin.cjs")` 会被拦下，
 * 所以用主入口（包根下的 index.mjs）反推包目录，再拼 bin.cjs。
 */
function resolveDrizzleKitBin() {
  const packageRoot = path.dirname(fileURLToPath(import.meta.resolve("drizzle-kit")));
  return path.join(packageRoot, "bin.cjs");
}

/**
 * 仓库里是 `drizzle.config.ts`（指向 src/db/*.ts），产物里是 `drizzle.config.mjs`（指向编译后的 db/*.js），
 * 按当前工作目录里哪个存在来选 —— 两边共用同一个脚本。
 */
function resolveConfigArgs() {
  for (const file of ["drizzle.config.mjs", "drizzle.config.ts"]) {
    if (existsSync(path.join(process.cwd(), file))) return ["--config", file];
  }

  throw new Error("找不到 drizzle 配置（drizzle.config.ts / drizzle.config.mjs）");
}
