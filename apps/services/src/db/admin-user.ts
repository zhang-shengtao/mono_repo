import { sql } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const adminUser = pgTable(
  "admin_user",
  {
    user_id: serial("user_id").primaryKey(),
    parent_id: integer("parent_id").notNull(),
    account: varchar("account", { length: 50 }).notNull().unique(),
    nickname: varchar("nickname", { length: 50 }).notNull(),
    password: varchar("password", { length: 255 }).notNull(),
    status: text("status").$type<"normal" | "disabled" | "deleted">().notNull().default("normal"),
    created_by: integer("created_by"),
    remark: varchar("remark", { length: 255 }),
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    deleted_at: timestamp("deleted_at", { mode: "string" }),
  },
  (table) => [index("idx_admin_user_parent_id").on(table.parent_id)],
);

export type AdminUser = typeof adminUser.$inferSelect;
