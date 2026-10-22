/** 菜单（目录 / 页面 / 按钮）的增删改查 */
import type { MenuListResult, MenuNode, MenuPayload, MenuUpdatePayload } from "@/types/menu";
import { request } from "./http";

export const menuApi = {
  list: (search = "") => request<MenuListResult>({ url: "/admin/menu/list", method: "get", params: { search } }),

  /** 新增：后端支持一次带上 children（本次不做批量，固定传空数组） */
  create: (data: MenuPayload) =>
    request<{ admin_menus_id: number }>({ url: "/admin/menu/list", method: "post", data: { ...data, children: [] } }),

  update: (data: MenuUpdatePayload) =>
    request<Record<string, unknown>>({ url: "/admin/menu/list", method: "put", data }),

  /** 物理删除，连同全部子菜单 */
  remove: (menuId: number) => request<Record<string, unknown>>({ url: `/admin/menu/list/${menuId}`, method: "delete" }),
};

export type { MenuNode };
