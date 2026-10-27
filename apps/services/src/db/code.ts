import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const code = pgTable(
  "code",
  {
    code: varchar("code", { length: 120 }).primaryKey(), // 权限码，唯一标识一条权限记录
    scope: varchar("scope", { length: 120 }).notNull(), // 权限作用域
    name: varchar("name", { length: 120 }).notNull(), // 权限名称
    bind_menu_id: integer("bind_menu_id"), // 绑定的菜单 ID
    is_disabled: boolean("is_disabled").notNull().default(false), // 是否禁用
    description: varchar("description", { length: 255 }), // 描述
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index("idx_code_bind_menu_id").on(table.bind_menu_id), index("idx_code_scope").on(table.scope)],
);

export type Code = typeof code.$inferSelect;
