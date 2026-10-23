import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { adminUser } from "./admin-user";
import { adminMenus } from "./admin-menus";

export const permissions = pgTable(
  "permissions",
  {
    user_id: integer("user_id")
      .references(() => adminUser.user_id)
      .notNull(),
    admin_menus_id: integer("admin_menus_id")
      .references(() => adminMenus.admin_menus_id)
      .notNull(),
    is_transmit: boolean("is_transmit").default(false).notNull(),
    is_disabled: boolean("is_disabled").default(false).notNull(),
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
  (table) => [primaryKey({ columns: [table.user_id, table.admin_menus_id] })],
);

export type Permissions = typeof permissions.$inferSelect;
