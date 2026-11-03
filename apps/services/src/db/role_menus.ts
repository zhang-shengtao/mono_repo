import { boolean, index, integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { adminMenus } from "./admin_menus";
import { roles } from "./roles";

/**
 * 角色包含哪些菜单（角色的「定义」）。
 *
 * 和 permissions 的分工：
 *   role_menus  角色 → 菜单，是模板本身，与具体用户无关，所以角色建好还没分配时也有数据
 *   permissions 用户 → 菜单 + 是哪个角色给的，是分配关系，由用户管理侧维护
 *
 * 纯关联表，不记审计字段：谁改的记在 roles.updated_by 上。
 */
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
