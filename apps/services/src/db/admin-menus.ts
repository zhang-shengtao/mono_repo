import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { code } from "./code";

// 管理后台的 目录、页面、按钮 表
export const adminMenus = pgTable(
  "admin_menus",
  {
    admin_menus_id: serial("admin_menus_id").primaryKey(), // 主键 自增ID
    type: text("type").$type<"directory" | "page" | "button">().notNull(), // 菜单类型 directory: 目录, page: 页面, button: 按钮
    parent_id: integer("parent_id").notNull().default(0), // 直接父级ID，0表示根节点
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull(), // 前端页面自己用的数据 服务端不用这个数据 只是存储
    permission: varchar("permission", { length: 120 }).references(() => code.code),
    sort: integer("sort").notNull().default(0), // 排序值
    is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    // 更新时间：UPDATE 时由数据库 now() 自动写入，业务代码不需要再手写
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("idx_admin_menus_parent_id").on(table.parent_id),
    index("idx_admin_menus_permission").on(table.permission),
  ],
);
