export const ROLE_PERMISSIONS = {
  SYSTEM_ROLE_ADD: "system:role:add",
  SYSTEM_ROLE_GET: "system:role:get",
  SYSTEM_ROLE_PUT: "system:role:put",
  SYSTEM_ROLE_DELETE: "system:role:delete",
} as const;

export const ROLE_PERMISSION_SEEDS = [
  {
    code: ROLE_PERMISSIONS.SYSTEM_ROLE_ADD,
    name: "新增角色",
    description: "管理员新增角色并配置菜单权限",
    scope: "role",
  },
  {
    code: ROLE_PERMISSIONS.SYSTEM_ROLE_GET,
    name: "查询角色",
    description: "管理员查询角色列表与菜单配置",
    scope: "role",
  },
  {
    code: ROLE_PERMISSIONS.SYSTEM_ROLE_PUT,
    name: "修改角色",
    description: "管理员修改角色资料、菜单权限与启停状态",
    scope: "role",
  },
  {
    code: ROLE_PERMISSIONS.SYSTEM_ROLE_DELETE,
    name: "删除角色",
    description: "管理员删除角色，并清理该角色的分配关系",
    scope: "role",
  },
] as const;
