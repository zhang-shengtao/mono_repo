import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { code } from "./code";

export const adminMenus = pgTable(
  "admin_menus",
  {
    admin_menus_id: serial("admin_menus_id").primaryKey(),
    type: text("type").$type<"directory" | "page" | "button">().notNull(),
    parent_id: integer("parent_id").notNull().default(0),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull(),
    permission: varchar("permission", { length: 120 }).references(() => code.code),
    sort: integer("sort").notNull().default(0),
    is_disabled: boolean("is_disabled").notNull().default(false),
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
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
