/**
 * 把数据库菜单树翻译成真实路由。
 *
 * 只有 type === "page" 的节点会生成路由（目录只是分组，按钮是权限点）。
 * 组件匹配顺序：
 *   1. meta.component（显式指定，最稳）
 *   2. meta.path 去掉前导 / 后的键，例如 /system/user → system/user
 *   3. 再补一层 /index，例如 system/user/index
 *   4. 都没有 → MissingPage（提示组件未实现，但页面不白屏）
 */
import type { Component } from "vue";
import type { Router } from "vue-router";
import MissingPage from "@/views/error/MissingPage.vue";
import type { MenuNode } from "@/types/menu";
import { flattenMenus, metaString } from "@/utils/menu";
import { pageRegistry } from "./routes";

/** 既可以是同步组件，也可以是懒加载函数，两者都被 vue-router 接受 */
export type PageComponent = Component | (() => Promise<Component>);

/** vue-router 的 addRoute 返回的卸载函数，登出 / 权限刷新时用来回收 */
const installedRemovers: Array<() => void> = [];

export function resolvePageComponent(menu: MenuNode): PageComponent {
  const pathKey = metaString(menu.meta, "path").replace(/^\/+/, "").replace(/\/+$/, "");
  const candidates = [metaString(menu.meta, "component"), pathKey, pathKey ? `${pathKey}/index` : ""].filter(
    (key): key is string => Boolean(key),
  );

  for (const key of candidates) {
    const loader = pageRegistry[key];
    if (loader) return loader;
  }
  return MissingPage;
}

export function resetMenuRoutes(): void {
  while (installedRemovers.length > 0) {
    const remove = installedRemovers.pop();
    remove?.();
  }
}

export function installMenuRoutes(router: Router, menus: MenuNode[]): void {
  resetMenuRoutes();

  const existingPaths = new Set(router.getRoutes().map((route) => route.path));
  const existingNames = new Set(router.getRoutes().map((route) => (route.name ? String(route.name) : "")));

  for (const menu of flattenMenus(menus)) {
    if (menu.type !== "page") continue;

    const path = metaString(menu.meta, "path");
    const name = metaString(menu.meta, "name");
    // 同名 / 同路径直接跳过：内置菜单和数据库菜单可能都想注册 /dashboard
    if (!path || !name || existingPaths.has(path) || existingNames.has(name)) continue;

    const remove = router.addRoute("Root", {
      path,
      name,
      component: resolvePageComponent(menu),
      meta: {
        title: metaString(menu.meta, "title") || name,
        icon: metaString(menu.meta, "icon") || undefined,
        permission: menu.permission ?? undefined,
        menuId: menu.admin_menus_id,
      },
    });

    installedRemovers.push(remove);
    existingPaths.add(path);
    existingNames.add(name);
  }
}
