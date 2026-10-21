export const USER_PERMISSIONS = {
  SYSTEM_USER_ADD: "system:user:add",
  SYSTEM_USER_GET: "system:user:get",
  SYSTEM_USER_PUT: "system:user:put",
  SYSTEM_USER_DELETE: "system:user:delete",
  SYSTEM_USER_PERMISSION_GET: "system:user:permission:get",
  SYSTEM_USER_PERMISSION_PUT: "system:user:permission:put",
} as const;

export const USER_PERMISSION_SEEDS = [
  {
    code: USER_PERMISSIONS.SYSTEM_USER_ADD,
    name: "新增用户",
    description: "管理员新增直属子用户",
    scope: "user",
  },
  {
    code: USER_PERMISSIONS.SYSTEM_USER_GET,
    name: "查询用户",
    description: "管理员查询直属子用户",
    scope: "user",
  },
  {
    code: USER_PERMISSIONS.SYSTEM_USER_PUT,
    name: "修改用户",
    description: "管理员修改直属子用户资料和状态",
    scope: "user",
  },
  {
    code: USER_PERMISSIONS.SYSTEM_USER_DELETE,
    name: "删除用户",
    description: "管理员软删除直属子用户",
    scope: "user",
  },
  {
    code: USER_PERMISSIONS.SYSTEM_USER_PERMISSION_GET,
    name: "查询用户权限",
    description: "管理员查询直属子用户的可分配权限",
    scope: "user",
  },
  {
    code: USER_PERMISSIONS.SYSTEM_USER_PERMISSION_PUT,
    name: "分配用户权限",
    description: "管理员设置直属子用户权限",
    scope: "user",
  },
] as const;
