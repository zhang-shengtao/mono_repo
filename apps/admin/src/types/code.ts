/** 权限码相关类型，字段与 apps/services/src/modules/code/code.schema.ts 对齐 */

import type { MenuType } from "./menu";

export interface CodeBoundMenu {
  admin_menus_id: number;
  type: MenuType;
  parent_id: number;
  meta: Record<string, unknown>;
  permission: string | null;
  sort: number;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionCodeItem {
  code: string;
  scope: string;
  name: string;
  is_disabled: boolean;
  description: string | null;
  bind_menu_id: number | null;
  created_at: string;
  updated_at: string;
  menu: CodeBoundMenu | null;
}

export interface CodeListQuery {
  page: number;
  limit: number;
  search: string;
  is_disabled: "all" | "true" | "false";
}

export interface CodeListResult {
  list: PermissionCodeItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CodeFilterQuery {
  is_disabled?: boolean;
  scope?: string;
  name?: string;
}
