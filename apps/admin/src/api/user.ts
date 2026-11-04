import type { CreateUserBody, UpdateUserBody, UserItem, UserListQuery, UserListResult, UserPermissionBody, UserPermissionDetail } from "@repo/shared";
import { http } from "@/utils/request";

export function fetchUserList(params?: UserListQuery) {
  return http.get<UserListResult>("/user/list", params as Record<string, unknown> | undefined);
}

export function createUser(body: CreateUserBody) {
  return http.post<UserItem>("/user/create", body);
}

export function updateUser(body: UpdateUserBody) {
  return http.put<UserItem>("/user/update", body);
}

export function deleteUser(user_id: number) {
  return http.delete<{ user_id: number }>(`/user/${user_id}`);
}

export function fetchUserPermission(user_id: number) {
  return http.get<UserPermissionDetail>(`/user/${user_id}/permission`);
}

export function saveUserPermission(body: UserPermissionBody) {
  return http.put<UserPermissionDetail>("/user/permission", body);
}
