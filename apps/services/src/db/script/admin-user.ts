/**
 * 管理员种子：创建/重置初始管理员账号。
 *
 * 与 permissions.ts 同理，放在 src/ 才能编进 dist，生产环境用
 * `node dist/db/script/admin-user.js` 执行，不依赖 tsx 和源码。
 *
 * 幂等：按 account 做 upsert，重复执行只会把密码重置成 ADMIN_SEED_PASSWORD。
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { adminUser } from "@/db/admin-user";
import { hashPassword } from "@/utils/password";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required");
}

const DEFAULT_PASSWORD = "123456";
const seedPassword = process.env.ADMIN_SEED_PASSWORD ?? DEFAULT_PASSWORD;

if (seedPassword === DEFAULT_PASSWORD) {
  console.warn(`[seed] 未设置 ADMIN_SEED_PASSWORD，将使用默认密码 ${DEFAULT_PASSWORD}，请不要在生产环境使用`);
}

const db = drizzle(databaseUrl);
const password = await hashPassword(seedPassword);

await db
  .insert(adminUser)
  .values({
    parent_id: 0,
    account: "admin",
    nickname: "系统管理员",
    password,
    status: "normal",
    created_by: 0,
    remark: "初始管理员账号",
  })
  .onConflictDoUpdate({
    target: adminUser.account,
    set: {
      parent_id: 0,
      nickname: "系统管理员",
      password,
      status: "normal",
      remark: "初始管理员账号",
    },
  });

await db.$client.end();

console.log("seed admin ok: admin / ******（密码取自 ADMIN_SEED_PASSWORD，未设置时为 123456）");
