import { boolean, int, json, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { code } from "./code";

// 管理后台的 目录、页面、按钮 表
export const adminMenus = mysqlTable("admin_menus", {
  admin_menus_id: int("admin_menus_id").autoincrement().primaryKey(), // 主键 自增ID
  type: mysqlEnum("type", ["directory", "page", "button"]).notNull(), // 菜单类型 directory: 目录, page: 页面, button: 按钮
  parent_id: int("parent_id").notNull().default(0), // 直接父级ID，0表示根节点
  meta: json("meta").$type<Record<string, unknown>>().notNull(), // 前端页面自己用的数据 服务端不用这个数据 只是存储
  permission: varchar("permission", { length: 120 }).references(() => code.code),
  sort: int("sort").notNull().default(0), // 排序值
  is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用
  created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
  updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(), // 更新时间
});
