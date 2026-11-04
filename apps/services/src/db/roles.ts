import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { adminUser } from "./admin_user";

export const roles = pgTable(
  "roles",
  {
    roles_id: serial("roles_id").primaryKey(), // 角色主键 ID
    roles_name: text("roles_name").notNull(), // 角色名称
    roles_description: text("roles_description"), // 角色描述
    is_disabled: boolean("is_disabled").default(false).notNull(), // 是否禁用
    updated_by: integer("updated_by")
      .references(() => adminUser.user_id)
      .notNull(), // 最后修改人

    created_by: integer("created_by")
      .references(() => adminUser.user_id)
      .notNull(),
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index("idx_roles_created_by").on(table.created_by)],
);

export type Roles = typeof roles.$inferSelect;
