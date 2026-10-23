import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const code = pgTable(
  "code",
  {
    code: varchar("code", { length: 120 }).primaryKey(),
    scope: varchar("scope", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    bind_menu_id: integer("bind_menu_id"),
    is_disabled: boolean("is_disabled").notNull().default(false),
    description: varchar("description", { length: 255 }),
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [index("idx_code_bind_menu_id").on(table.bind_menu_id), index("idx_code_scope").on(table.scope)],
);

export type Code = typeof code.$inferSelect;
