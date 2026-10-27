import { sql } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const adminUser = pgTable(
  "admin_user",
  {
    user_id: serial("user_id").primaryKey(), // 用户主键 ID
    parent_id: integer("parent_id").notNull(), // 上级用户 ID
    account: varchar("account", { length: 50 }).notNull().unique(), // 账户名
    nickname: varchar("nickname", { length: 50 }).notNull(), // 昵称
    password: varchar("password", { length: 255 }).notNull(), // 密码
    status: text("status").$type<"normal" | "disabled" | "deleted">().notNull().default("normal"), // 状态 normal(正常) / disabled(禁用) / deleted(已删除)
    created_by: integer("created_by"), // 创建人
    remark: varchar("remark", { length: 255 }), // 备注
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`), // 更新时间
    deleted_at: timestamp("deleted_at", { mode: "string" }), // 删除时间
  },
  (table) => [index("idx_admin_user_parent_id").on(table.parent_id)],
);

export type AdminUser = typeof adminUser.$inferSelect;
