/** 菜单（目录 / 页面 / 按钮）相关类型，字段与 apps/services/src/modules/menu/menu.schema.ts 对齐 */

export type MenuType = "directory" | "page" | "button";

/**
 * 菜单的 meta 由数据库原样存储，服务端只校验少数字段：
 * - title：必填，侧边栏与面包屑文案
 * - path：目录 / 页面必填，以 / 开头
 * - name：目录 / 页面必填，路由名，需全局唯一
 * - icon：可选，@element-plus/icons-vue 的组件名
 * - component：可选，视图组件键；不填则按 path 自动匹配内置组件表
 */
export interface MenuMeta {
  title?: string;
  path?: string;
  name?: string;
  icon?: string;
  component?: string;
  [key: string]: unknown;
}

export interface MenuNode {
  admin_menus_id: number;
  type: MenuType;
  parent_id: number;
  meta: MenuMeta;
  permission: string | null;
  sort: number;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
  children: MenuNode[];
}

export interface MenuPayload {
  type: MenuType;
  parent_id: number;
  meta: MenuMeta;
  permission: string | null;
  sort: number;
  is_disabled: boolean;
}

export interface MenuUpdatePayload extends MenuPayload {
  admin_menus_id: number;
}

export interface MenuListResult {
  list: MenuNode[];
}
