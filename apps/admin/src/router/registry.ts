import type { RouteMeta, RouteRecordRaw } from "vue-router";
import { joinPath } from "./path";

export interface RouteSource {
  path: string;
  name?: string;
  component?: RouteRecordRaw["component"];

  meta: RouteMeta;
  props?: Record<string, unknown>;
  redirect?: RouteRecordRaw["redirect"];

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

export function findRouteSource(path: string) {
  return registry.get(path);
}
