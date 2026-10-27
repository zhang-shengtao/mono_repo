import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { code } from "./code";

export const adminMenus = pgTable(
  "admin_menus",
  {
    menus_id: serial("menus_id").primaryKey(), // 菜单主键 ID
    type: text("type").$type<"directory" | "page" | "button">().notNull(), // 菜单类型：目录 / 页面 / 按钮
    parent_id: integer("parent_id").notNull().default(0), // 父级菜单 ID，顶级菜单为 0
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull(), // 菜单元数据，存储前端路由所需的各种信息
    permission: varchar("permission", { length: 120 }).references(() => code.code), // 权限码，关联 code 表的 code 字段
    sort: integer("sort").notNull().default(0), // 排序值，越大越靠前
    is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用，禁用的菜单不会出现在前端路由里
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`), // 更新时间
  },
  (table) => [index("idx_admin_menus_parent_id").on(table.parent_id), index("idx_admin_menus_permission").on(table.permission)],
);
