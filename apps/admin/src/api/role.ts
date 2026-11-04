import type { CreateRoleBody, RoleItem, RoleListQuery, RoleListResult, RoleMenuScope, UpdateRoleBody } from "@repo/shared";
import { http } from "@/utils/request";

export function fetchRoleList(params?: RoleListQuery) {
  return http.get<RoleListResult>("/role/list", params as Record<string, unknown> | undefined);
}

export function fetchRoleMenuScope() {
  return http.get<RoleMenuScope>("/role/menu-scope");
}

export function createRole(body: CreateRoleBody) {
  return http.post<RoleItem>("/role/create", body);
}

export function updateRole(body: UpdateRoleBody) {
  return http.put<RoleItem>("/role/update", body);
}

export function deleteRole(roles_id: number) {
  return http.delete<{ roles_id: number }>(`/role/${roles_id}`);
}
