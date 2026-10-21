import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// 管理后台的用户表
export const adminUser = pgTable(
  "admin_user",
  {
    user_id: serial("user_id").primaryKey(), // 自增主键 ID
    parent_id: integer("parent_id").notNull(), // 直接父级用户 ID，超级管理员可为0
    account: varchar("account", { length: 50 }).notNull().unique(), // 用户账号
    nickname: varchar("nickname", { length: 50 }).notNull(), // 用户昵称
    password: varchar("password", { length: 255 }).notNull(), // 登录密码哈希
    // 用 text + TS 联合类型代替 PG enum：状态值后续增减不需要 ALTER TYPE
    status: text("status").$type<"normal" | "disabled" | "deleted">().notNull().default("normal"), // 状态：normal(启用) / disabled(禁用) / deleted(删除)
    created_by: integer("created_by"), // 创建人 ID
    remark: varchar("remark", { length: 255 }), // 备注
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(), // 更新时间
    deleted_at: timestamp("deleted_at", { mode: "string" }), // 软删除时间
  },
  (table) => [index("idx_admin_user_parent_id").on(table.parent_id)],
);

export type AdminUser = typeof adminUser.$inferSelect;
