import { boolean, int, timestamp, varchar, mysqlTable } from "drizzle-orm/mysql-core";

// 所有的 接口 权限码
export const code = mysqlTable("code", {
  code: varchar("code", { length: 120 }).notNull().unique().primaryKey(), // 主键编码 唯一标识
  scope: varchar("scope", { length: 120 }).notNull(), // 父级权限编码，用于权限分组
  name: varchar("name", { length: 120 }).notNull(), // 权限名称
  bind_menu_id: int("bind_menu_id"),
  is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用：false 启用，true 禁用
  description: varchar("description", { length: 255 }), // 权限描述
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(), // 更新时间
});

export type Code = typeof code.$inferSelect;
