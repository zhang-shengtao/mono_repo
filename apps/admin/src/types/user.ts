/** 管理员账号 / 用户管理相关类型，字段与 apps/services/src/modules/user/user.schema.ts 对齐 */

import type { MenuType } from "./menu";

export type UserStatus = "normal" | "disabled" | "deleted";

export interface AdminProfile {
  user_id: number;
  parent_id: number;
  account: string;
  nickname: string;
  status: UserStatus;
  created_by: number | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** 列表项与详情同构 */
export type UserItem = AdminProfile;

export interface UserListQuery {
  page: number;
  limit: number;
  search: string;
  status: "all" | "normal" | "disabled";
}

export interface UserListResult {
  list: UserItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UserAddPayload {
  account: string;
  nickname: string;
  password: string;
  remark: string | null;
}

export interface UserUpdatePayload {
  user_id: number;
  nickname: string;
  status: "normal" | "disabled";
  password?: string;
  remark: string | null;
}

/** 可分配给直属子账号的菜单项（含目录 / 页面 / 按钮，扁平结构，靠 parent_id 组树） */
export interface UserPermissionItem {
  admin_menus_id: number;
  type: MenuType;
  parent_id: number;
  meta: Record<string, unknown>;
  permission: string | null;
  sort: number;
  granted: boolean;
  is_transmit: boolean;
}

export interface UserPermissionPayload {
  user_id: number;
  permissions: Array<{ admin_menus_id: number; is_transmit: boolean }>;
}
