/**
 * `db:reset` 的第一步：把目标库整个删掉重建（DROP ... WITH (FORCE) → CREATE）。
 *
 * 为什么不能直接删库：
 *   PostgreSQL 的 `DROP DATABASE` 只要还有**任意一个**其它会话连着就会被拒，报错就是 Navicat 弹的
 *   `database "server_demo" is being accessed by other users`（DETAIL: 那里有 2 个其它会话正在使用数据库）。
 *   那 2 个会话往往就是 Navicat 自己 —— 左侧连接树停在 server_demo 上、开着的查询窗口、对象页签，
 *   各自都是一个独立会话；业务服务停了它们也不会跟着断，要等客户端断开或进程退出。
 *   用 `WITH (FORCE)`（PG 13+）让库自己 `pg_terminate_backend` 踢掉它们，不存在「先踢再删」之间被重连插队的竞态。
 *
 * 为什么先连 postgres 库：
 *   要删的那个库上不能有会话在跑 `DROP DATABASE`，所以维护连接挂在 postgres（目标就是 postgres 时退到 template1）。
 *
 * 与 push / seed 的分工：
 *   本脚本只负责「得到一个空库」；表结构由 `db:push`（drizzle-kit push 走 schema diff）同步，
 *   种子由 `db:seed:permissions` / `db:seed:admin` 灌 —— `pnpm db:reset` 把这几步串成一条命令。
 *   故意只挂在仓库的 package.json 上、不写进 dist 产物（见 scripts/build.ts）：重置是开发期操作，
 *   生产环境只该跑 `db:push` 和种子，不该留一个「一条命令清库」的入口。
 *
 * 用法：
 *   pnpm db:reset      # 删库 → 建库 → 同步结构 → 灌种子
 *   pnpm db:recreate   # 只删库建库，结构和种子自己另跑
 */
import { drizzle } from "drizzle-orm/node-postgres";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required（db:reset 要连库）");
}

const target = new URL(databaseUrl);
const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));

if (!databaseName) {
  throw new Error(`APP_DATABASE_URL 里没有库名：${databaseUrl}`);
}

/** 维护库：DROP DATABASE 不能挂在被删的那个库上执行 */
const maintenance = new URL(target);
maintenance.pathname = databaseName === "postgres" ? "/template1" : "/postgres";

const quotedName = quoteIdent(databaseName);
const db = drizzle(maintenance.toString());
const client = await db.$client.connect();

try {
  await dropDatabase();
  await client.query(`create database ${quotedName}`);
  console.log(`[db:recreate] ok: ${databaseName} 已是空库`);
} finally {
  client.release();
  await db.$client.end();
}

/**
 * `WITH (FORCE)` 是 PG 13+ 才有；更老的库退回到「先 terminate 再删」。
 * 这条路有极小的重连窗口，但只会在 PG 13 以下出现，重置一次失败重跑即可。
 */
async function dropDatabase() {
  try {
    await client.query(`drop database if exists ${quotedName} with (force)`);
    return;
  } catch (error) {
    if (!isUnsupportedForceOption(error)) throw error;
  }

  await client.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
    [databaseName],
  );
  await client.query(`drop database if exists ${quotedName}`);
}

/** 只有「语法不认识 FORCE」（42601）才降级，其它错误（权限、连接断开）要原样抛出去 */
function isUnsupportedForceOption(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42601";
}

/** 库名要用双引号标识符拼进 DDL，内部的双引号按 SQL 规则翻倍转义 */
function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}
