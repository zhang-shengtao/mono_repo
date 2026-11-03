import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { adminUser } from "./admin_user";
import { adminMenus } from "./admin_menus";
import { roles } from "./roles";

export const permissions = pgTable(
  "permissions",
  {
    user_id: integer("user_id")
      .references(() => adminUser.user_id)
      .notNull(), // 用户表主键ID
    menus_id: integer("menus_id")
      .references(() => adminMenus.menus_id)
      .notNull(), // 菜单表主键ID
    roles_id: integer("roles_id")
      .references(() => roles.roles_id)
      .notNull(), // 角色表主键ID
    is_transmit: boolean("is_transmit").default(false).notNull(), // 是否可以给下级使用
    is_disabled: boolean("is_disabled").default(false).notNull(), // 是否禁用
    updated_by: integer("updated_by")
      .references(() => adminUser.user_id)
      .notNull(),
    created_by: integer("created_by")
      .references(() => adminUser.user_id)
      .notNull(),
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.menus_id] })],
);

export type Permissions = typeof permissions.$inferSelect;
