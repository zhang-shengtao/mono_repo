/**
 * drizzle-kit 配置：`src/db/*.ts` 是唯一的结构定义，同步库结构靠 `drizzle-kit push`（`pnpm db:push`）。
 *
 * 开发和生产用同一个机制 —— 「把 schema 和活库 diff，然后直接执行 DDL」：
 *   仓库：pnpm db:push     → 读 src/db/*.ts（就是本文件）
 *   dist：npm run db:push  → 读编译后的 db/*.js（dist/drizzle.config.mjs，由 build 生成）
 *
 * 所以 drizzle-kit 是**运行时依赖**（写在 dependencies 里），会跟着 dist 一起上服务器；
 * 仓库里不再生成/提交任何 SQL 迁移文件，也没有迁移账本要维护。
 *
 * push 必须连库，dbCredentials 从 APP_DATABASE_URL 读（脚本用 --env-file 注入，dev 是 `.env`，
 * dist 是 --env-file-if-exists，没有文件就用平台注入的环境变量）。
 */
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required（drizzle-kit push 要连库做 schema diff）");
}

export default defineConfig({
  schema: "src/db/*.ts",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
