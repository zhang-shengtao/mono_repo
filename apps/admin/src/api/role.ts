import type { CreateRoleBody, RoleItem, RoleListQuery, RoleListResult, RoleMenuScope, UpdateRoleBody } from "@repo/shared";
import { http } from "@/utils/request";

/** 角色接口：参数 / 响应类型统一来自 @repo/shared，页面只关心调用 */
export function fetchRoleList(params?: RoleListQuery) {
  return http.get<RoleListResult>("/role/list", params as Record<string, unknown> | undefined);
}

/** 角色表单的菜单候选范围：超管拿全量，二级管理员只拿自己可下放的 */
export function fetchRoleMenuScope() {
  return http.get<RoleMenuScope>("/role/menu-scope");
}

/** 新增角色：menus_id 传角色包含的菜单全量集合，transmit_menus_id 传其中可下放的部分，服务端会补齐上级 */
export function createRole(body: CreateRoleBody) {
  return http.post<RoleItem>("/role/create", body);
}

/** 编辑角色：整行覆盖，减掉的菜单会同步清理用户的对应授权 */
export function updateRole(body: UpdateRoleBody) {
  return http.put<RoleItem>("/role/update", body);
}

export function deleteRole(roles_id: number) {
  return http.delete<{ roles_id: number }>(`/role/${roles_id}`);
}
