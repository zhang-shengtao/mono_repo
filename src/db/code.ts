import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// 所有的 接口 权限码
export const code = pgTable(
  "code",
  {
    code: varchar("code", { length: 120 }).primaryKey(), // 主键编码 唯一标识
    scope: varchar("scope", { length: 120 }).notNull(), // 父级权限编码，用于权限分组
    name: varchar("name", { length: 120 }).notNull(), // 权限名称
    bind_menu_id: integer("bind_menu_id"),
    is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用：false 启用，true 禁用
    description: varchar("description", { length: 255 }), // 权限描述
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    updated_at: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(), // 更新时间
  },
  (table) => [index("idx_code_bind_menu_id").on(table.bind_menu_id), index("idx_code_scope").on(table.scope)],
);

export type Code = typeof code.$inferSelect;
