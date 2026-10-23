import { MENU_PERMISSIONS, MENU_PERMISSION_SEEDS } from "./menu";
import { USER_PERMISSIONS, USER_PERMISSION_SEEDS } from "./user";

export const PERMISSIONS = {
  ...MENU_PERMISSIONS,
  ...USER_PERMISSIONS,
} as const;

export const PERMISSION_SEEDS = [...MENU_PERMISSION_SEEDS, ...USER_PERMISSION_SEEDS] as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
