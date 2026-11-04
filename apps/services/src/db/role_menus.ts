import { boolean, index, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { adminMenus } from "./admin_menus";
import { roles } from "./roles";

export const roleMenus = pgTable(
  "role_menus",
  {
    roles_id: integer("roles_id")
      .references(() => roles.roles_id)
      .notNull(), // 角色表主键ID
    menus_id: integer("menus_id")
      .references(() => adminMenus.menus_id)
      .notNull(), // 菜单表主键ID
    is_transmit: boolean("is_transmit").default(false).notNull(), // 持有该角色的账号能否把这条菜单再下放给下级
  },
  (table) => [primaryKey({ columns: [table.roles_id, table.menus_id] }), index("idx_role_menus_menus_id").on(table.menus_id)],
);

export type RoleMenus = typeof roleMenus.$inferSelect;
