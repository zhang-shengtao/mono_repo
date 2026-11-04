import type { CreateMenuBody, MenuNode, MenuTreeQuery, MenuTreeResult, UpdateMenuBody } from "@repo/shared";
import { http } from "@/utils/request";

export function fetchMenuTree(params?: MenuTreeQuery) {
  return http.get<MenuTreeResult>("/menu/tree", params as Record<string, unknown> | undefined);
}

export function createMenu(body: CreateMenuBody) {
  return http.post<MenuNode>("/menu/create", body);
}

export function updateMenu(body: UpdateMenuBody) {
  return http.put<MenuNode>("/menu/update", body);
}

export function deleteMenu(menus_id: number) {
  return http.delete<{ menus_id: number }>(`/menu/${menus_id}`);
}
