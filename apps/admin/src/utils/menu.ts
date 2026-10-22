/** 菜单树的纯函数工具：组树、取 meta、收权限码、找路径 */
import type { MenuMeta, MenuNode, MenuType } from "@/types/menu";

export interface TreeLike {
  admin_menus_id: number;
  parent_id: number;
}

export type WithChildren<T> = T & { children: WithChildren<T>[] };

/** 把 parent_id 扁平列表组成树，根节点是 parent_id === 0（或被父级丢弃的孤立节点） */
export function buildTree<T extends TreeLike>(rows: T[]): WithChildren<T>[] {
  const nodeMap = new Map<number, WithChildren<T>>();
  for (const row of rows) nodeMap.set(row.admin_menus_id, { ...row, children: [] });

  const roots: WithChildren<T>[] = [];
  for (const node of nodeMap.values()) {
    const parent = node.parent_id === 0 ? undefined : nodeMap.get(node.parent_id);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** meta 里的值来自数据库，类型是 unknown，统一安全取字符串 */
export function metaString(meta: MenuMeta | Record<string, unknown>, key: string): string {
  const value = meta?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function menuTitle(menu: { admin_menus_id: number; meta: MenuMeta | Record<string, unknown> }): string {
  return metaString(menu.meta, "title") || `菜单 #${menu.admin_menus_id}`;
}

export function flattenMenus(menus: MenuNode[]): MenuNode[] {
  const result: MenuNode[] = [];
  const walk = (nodes: MenuNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(menus);
  return result;
}

/** 当前用户可见菜单里出现的全部权限码（页面 + 按钮） */
export function collectPermissions(menus: MenuNode[]): string[] {
  const codes = new Set<string>();
  for (const menu of flattenMenus(menus)) {
    if (menu.permission) codes.add(menu.permission);
  }
  return [...codes];
}

export function hasPageMenu(menus: MenuNode[]): boolean {
  return flattenMenus(menus).some((menu) => menu.type === "page");
}

/** 登录后的默认落地页：第一个可用页面菜单，没有就用 /dashboard */
export function firstPagePath(menus: MenuNode[]): string | undefined {
  const page = flattenMenus(menus).find((menu) => menu.type === "page" && !menu.is_disabled);
  return page ? metaString(page.meta, "path") || undefined : undefined;
}

export function countMenus(menus: MenuNode[]): number {
  return flattenMenus(menus).length;
}

/** 按路径找回菜单链（目录 → 页面），供面包屑使用 */
export function findMenuChain(menus: MenuNode[], path: string): MenuNode[] {
  const chain: MenuNode[] = [];
  const walk = (nodes: MenuNode[]): boolean => {
    for (const node of nodes) {
      chain.push(node);
      if (metaString(node.meta, "path") === path) return true;
      if (node.children?.length && walk(node.children)) return true;
      chain.pop();
    }
    return false;
  };
  return walk(menus) ? chain : [];
}

/** 侧边栏渲染前先剔掉按钮、禁用项，以及没有可见子节点的空目录 */
export function filterSidebarMenus(menus: MenuNode[]): MenuNode[] {
  return menus
    .filter((menu) => !menu.is_disabled && menu.type !== "button")
    .map((menu) => ({ ...menu, children: filterSidebarMenus(menu.children ?? []) }))
    .filter((menu) => menu.type === "page" || menu.children.length > 0);
}

export interface SelectOptionNode {
  value: number;
  label: string;
  children?: SelectOptionNode[];
}

/** 父级选择器的候选树：只保留同类型节点，并可排除某个子树（编辑时不能选自己） */
export function buildMenuSelectOptions(menus: MenuNode[], type: MenuType, excludeId?: number): SelectOptionNode[] {
  const options: SelectOptionNode[] = [];
  for (const menu of menus) {
    if (menu.admin_menus_id === excludeId) continue;
    if (menu.type !== type) {
      options.push(...buildMenuSelectOptions(menu.children ?? [], type, excludeId));
      continue;
    }
    const children = buildMenuSelectOptions(menu.children ?? [], type, excludeId);
    options.push({ value: menu.admin_menus_id, label: menuTitle(menu), ...(children.length ? { children } : {}) });
  }
  return options;
}
