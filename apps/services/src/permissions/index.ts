// 权限码集合。
//
// 分层约定：这里的常量只服务 api 自己，不作为前端契约。
//   1. 路由声明期的 config.auth.permission —— 配合 PermissionCode 在编译期挡住手写权限码的 typo
//   2. db:seed:permissions 脚本，把种子同步进 code 表
//
// 运行时的权限一律以数据库为准：code 表才是权限码的唯一事实源（还带着 scope / is_disabled /
// bind_menu_id / 时间戳这些常量里没有的字段）。接口出入参统一用普通字符串，前端通过
// /code 系列接口读表数据，千万不要 import 这里的常量去做按钮级判断。
import { MENU_PERMISSIONS, MENU_PERMISSION_SEEDS } from "./menu";
import { USER_PERMISSIONS, USER_PERMISSION_SEEDS } from "./user";

// 权限码
export const PERMISSIONS = {
  ...MENU_PERMISSIONS,
  ...USER_PERMISSIONS,
} as const;

// 权限码种子数据，db:seed:permissions（源码态和 dist 同名）按它同步 code 表
export const PERMISSION_SEEDS = [...MENU_PERMISSION_SEEDS, ...USER_PERMISSION_SEEDS] as const;

// ts枚举
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
