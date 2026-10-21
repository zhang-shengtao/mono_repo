// 权限码集合
import { MENU_PERMISSIONS, MENU_PERMISSION_SEEDS } from "./menu";
import { USER_PERMISSIONS, USER_PERMISSION_SEEDS } from "./user";

// 权限码
export const PERMISSIONS = {
  ...MENU_PERMISSIONS,
  ...USER_PERMISSIONS,
} as const;

// 权限码种子数据要同步表结构用的
export const PERMISSION_SEEDS = [...MENU_PERMISSION_SEEDS, ...USER_PERMISSION_SEEDS] as const;

// 权限码值集合
export const PERMISSION_CODES = Object.values(PERMISSIONS);

// ts枚举
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
