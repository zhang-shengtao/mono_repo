/** 直属子账号的增删改查与权限分配 */
import type {
  UserAddPayload,
  UserItem,
  UserListQuery,
  UserListResult,
  UserPermissionItem,
  UserPermissionPayload,
  UserUpdatePayload,
} from "@/types/user";
import { request } from "./http";

export const userApi = {
  list: (params: UserListQuery) => request<UserListResult>({ url: "/admin/user/list", method: "get", params }),

  add: (data: UserAddPayload) => request<{ user_id: number }>({ url: "/admin/user/list", method: "post", data }),

  update: (data: UserUpdatePayload) =>
    request<Record<string, unknown>>({ url: "/admin/user/list", method: "put", data }),

  remove: (userId: number) => request<Record<string, unknown>>({ url: `/admin/user/list/${userId}`, method: "delete" }),

  /** 该子账号当前可分配 / 已拥有的菜单权限（扁平列表，contains granted / is_transmit） */
  permissions: (userId: number) =>
    request<{ list: UserPermissionItem[] }>({ url: `/admin/user/permissions/${userId}`, method: "get" }),

  savePermissions: (data: UserPermissionPayload) =>
    request<Record<string, unknown>>({ url: "/admin/user/permissions", method: "put", data }),
};

export type { UserItem };
