import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { adminUser } from "./admin-user";
import { adminMenus } from "./admin-menus";

// 所有用户关联权限表
export const permissions = pgTable(
  "permissions",
  {
    user_id: integer("user_id")
      .references(() => adminUser.user_id)
      .notNull(),
    admin_menus_id: integer("admin_menus_id")
      .references(() => adminMenus.admin_menus_id)
      .notNull(),
    is_transmit: boolean("is_transmit").default(false).notNull(), // 是否可以给子级账户使用这个权限 false:不支持 true:支持
    is_disabled: boolean("is_disabled").default(false).notNull(), // 是否禁用 false:未禁用 true:禁用
    updated_by: integer("updated_by")
      .references(() => adminUser.user_id)
      .notNull(), // 修改人
    created_by: integer("created_by")
      .references(() => adminUser.user_id)
      .notNull(), // 创建人
    created_at: timestamp("created_at", { mode: "string" }).defaultNow().notNull(), // 创建时间
    // 更新时间：UPDATE 时由数据库 now() 自动写入，业务代码不需要再手写
    updated_at: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.admin_menus_id] })],
);

export type Permissions = typeof permissions.$inferSelect;
