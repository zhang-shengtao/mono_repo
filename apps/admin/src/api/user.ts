import type { CreateUserBody, UpdateUserBody, UserItem, UserListQuery, UserListResult, UserPermissionBody, UserPermissionDetail } from "@repo/shared";
import { http } from "@/utils/request";

/** 用户接口：参数 / 响应类型统一来自 @repo/shared，页面只关心调用 */
export function fetchUserList(params?: UserListQuery) {
  return http.get<UserListResult>("/user/list", params as Record<string, unknown> | undefined);
}

/** 新增直属下级：parent_id 由服务端取当前登录人，不用传 */
export function createUser(body: CreateUserBody) {
  return http.post<UserItem>("/user/create", body);
}

/** 编辑直属下级：账号不可改，password 留空表示不修改 */
export function updateUser(body: UpdateUserBody) {
  return http.put<UserItem>("/user/update", body);
}

export function deleteUser(user_id: number) {
  return http.delete<{ user_id: number }>(`/user/${user_id}`);
}

/** 用户权限：已分配的角色 / 菜单 + 当前登录人可分配的范围 */
export function fetchUserPermission(user_id: number) {
  return http.get<UserPermissionDetail>(`/user/${user_id}/permission`);
}

/** 保存用户权限：全量覆盖，menus_id 必须落在所选角色的菜单并集里 */
export function saveUserPermission(body: UserPermissionBody) {
  return http.put<UserPermissionDetail>("/user/permission", body);
}
