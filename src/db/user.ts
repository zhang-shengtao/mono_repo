import { int, timestamp, varchar, mysqlTable } from "drizzle-orm/mysql-core";

// 所有的接口权限表
export const user = mysqlTable("user", {
  user_id: int("user_id").autoincrement().primaryKey(), // 新增：自增主键 ID
  account: varchar("account", { length: 50 }).notNull().unique(), // 用户账号
  nickname: varchar("nickname", { length: 50 }).notNull(), // 用户昵称
  password: varchar("password", { length: 255 }).notNull(), // 登录密码哈希
  status: varchar("status", { length: 20 }).notNull().default("normal"), // 状态：normal(启用) / disabled(禁用) / deleted(删除)
  reamk: varchar("remark", { length: 255 }), // 备注
  created_at: timestamp("created_at").defaultNow().notNull(), // 创建时间
  updated_at: timestamp("updated_at").defaultNow().notNull(), // 更新时间
  deleted_at: timestamp("deleted_at"), // 软删除时间
});

export type User = typeof user.$inferSelect;
