/// <reference types="node" />

import { drizzle } from "drizzle-orm/mysql2";
import { adminUser } from "../src/db/admin-user";
import { hashPassword } from "../src/utils/password";

const mysqlUrl = process.env.MYSQL_URL;

if (!mysqlUrl) {
  throw new Error("MYSQL_URL is required");
}

const db = drizzle(mysqlUrl);
const password = await hashPassword("123456");

await db
  .insert(adminUser)
  .values({
    parent_id: 0,
    account: "admin",
    nickname: "系统管理员",
    password,
    status: "normal",
    created_by: 0,
    remark: "开发环境初始管理员",
  })
  .onDuplicateKeyUpdate({
    set: {
      parent_id: 0,
      nickname: "系统管理员",
      password,
      status: "normal",
      remark: "开发环境初始管理员",
    },
  });

await new Promise<void>((resolve, reject) => {
  db.$client.end((error) => {
    if (error) reject(error);
    else resolve();
  });
});

console.log("seed admin ok: admin / 123456");
