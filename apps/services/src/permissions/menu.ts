export const MENU_PERMISSIONS = {
  SYSTEM_MENU_ADD: "system:menu:add",
  SYSTEM_MENU_PUT: "system:menu:put",
  SYSTEM_MENU_GET: "system:menu:get",
  SYSTEM_MENU_DELETE: "system:menu:delete",
  SYSTEM_CODE_GET: "system:code:get",
  SYSTEM_CODE_PUT: "system:code:put",
} as const;

export const MENU_PERMISSION_SEEDS = [
  {
    code: MENU_PERMISSIONS.SYSTEM_MENU_ADD,
    name: "添加菜单",
    description: "管理员添加路由菜单",
    scope: "menu",
  },
  {
    code: MENU_PERMISSIONS.SYSTEM_MENU_PUT,
    name: "修改菜单",
    description: "管理员修改路由菜单",
    scope: "menu",
  },
  {
    code: MENU_PERMISSIONS.SYSTEM_MENU_GET,
    name: "获取菜单",
    description: "管理员获取路由菜单",
    scope: "menu",
  },
  {
    code: MENU_PERMISSIONS.SYSTEM_MENU_DELETE,
    name: "删除菜单",
    description: "管理员删除路由菜单",
    scope: "menu",
  },
  {
    code: MENU_PERMISSIONS.SYSTEM_CODE_GET,
    name: "获取权限",
    description: "管理员获取权限",
    scope: "code",
  },
  {
    code: MENU_PERMISSIONS.SYSTEM_CODE_PUT,
    name: "修改权限",
    description: "管理员修改权限",
    scope: "code",
  },
] as const;
