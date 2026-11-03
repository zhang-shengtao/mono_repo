import type { RouteMeta, RouteRecordRaw } from "vue-router";
import { joinPath } from "./path";

/**
 * 前端路由索引：把 modules 下的静态路由表拍平成「完整路径 → 路由配置」。
 *
 * 这里刻意**不拍平 `/` 壳、不剔除 hidden**（那是侧栏菜单的事，见 pinia/user.ts 的 menuArr）：
 * 动态路由注册时要知道谁是 layout 壳，hidden 的页面（比如详情页）也照样得注册。
 */
export interface RouteSource {
  /** 完整路径（绝对），动态路由比对与注册都用它 */
  path: string;
  name?: string;
  component?: RouteRecordRaw["component"];
  /** 前端静态 meta：icon 这类后端不开放的配置从这里来 */
  meta: RouteMeta;
  props?: Record<string, unknown>;
  redirect?: RouteRecordRaw["redirect"];
  /** 有 children 的路由 = layout 壳；后端返回的目录必须命中它 */
  isLayout: boolean;
}

const modules = import.meta.glob<{ default: RouteRecordRaw[] }>(["./modules/*.ts", "!./modules/static.ts"], { eager: true });

const registry = new Map<string, RouteSource>();

function walk(routes: RouteRecordRaw[], parentAbs: string) {
  for (const route of routes) {
    const path = joinPath(parentAbs, route.path);
    const isLayout = Boolean(route.children?.length);

    registry.set(path, {
      path,
      name: route.name ? String(route.name) : undefined,
      component: route.component,
      meta: route.meta ?? {},
      props: route.props && typeof route.props === "object" ? (route.props as Record<string, unknown>) : undefined,
      redirect: route.redirect,
      isLayout,
    });

    if (route.children?.length) walk(route.children, path);
  }
}

walk(
  Object.values(modules).flatMap((module) => module.default),
  "",
);

export const routeRegistry = registry;

/** 按完整路径找前端配置；找不到说明后端配了前端没有的页面 */
export function findRouteSource(path: string) {
  return registry.get(path);
}
