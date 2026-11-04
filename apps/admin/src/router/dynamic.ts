import type { RouteMeta, RouteRecordRaw } from "vue-router";
import type { AuthMenuNode } from "@repo/shared";
import { isExternal, resolveMenuPath } from "./path";
import { findRouteSource } from "./registry";

export interface AppMenuNode {
  path: string;
  name?: string;
  meta: RouteMeta;
  children?: AppMenuNode[];

  external?: boolean;
}

export interface BuildResult {
  routes: RouteRecordRaw[];

  menuTree: AppMenuNode[];
}

interface BuiltNode {
  top: boolean;
  route?: RouteRecordRaw;
  menu: AppMenuNode;
}

export function buildRoutes(menus: AuthMenuNode[]): BuildResult {
  const routes: RouteRecordRaw[] = [];
  const menuTree: AppMenuNode[] = [];

  const loose: BuiltNode[] = [];

  for (const node of menus) {
    const built = buildNode(node, "");
    if (!built) continue;
    if (built.top) {
      loose.push(built);
      continue;
    }
    if (built.route) routes.push(built.route);
    menuTree.push(built.menu);
  }

  if (loose.length > 0) {
    const pageRoutes = loose.flatMap((item) => (item.route ? [item.route] : []));
    const shell = findRouteSource("/");

    if (shell && pageRoutes.length > 0) {
      routes.unshift({
        path: "/",
        name: shell.name,
        component: shell.component,
        meta: shell.meta,
        redirect: pageRoutes[0].path,
        children: pageRoutes,
      } as RouteRecordRaw);
      menuTree.unshift({ path: "/", name: shell.name, meta: shell.meta, children: loose.map((item) => item.menu) });
    } else {
      menuTree.unshift(...loose.map((item) => item.menu));
    }
  }

  return { routes, menuTree };
}

function buildNode(node: AuthMenuNode, parentAbs: string): BuiltNode | null {
  if (node.type === "button") return null;

  const path = resolveMenuPath(parentAbs, node.meta.path);

  const topPage = parentAbs === "";

  if (isExternal(path)) {
    return { top: topPage, menu: { path, meta: mergeMeta({}, node, true), external: true } };
  }

  const source = findRouteSource(path);
  if (!source) {
    console.warn(`[router] 菜单「${node.meta.title}」的路径 ${path} 在前端路由表里找不到对应页面，已跳过。请在 src/router/modules 下补页面，或修正菜单里的路径。`);
    return null;
  }

  if (node.type === "directory") {
    if (!source.isLayout) {
      console.warn(`[router] 菜单「${node.meta.title}」是目录，但前端 ${path} 不是带子路由的 layout，已跳过。`);
      return null;
    }

    const children = (node.children ?? []).flatMap((child) => {
      const built = buildNode(child, path);
      return built ? [built] : [];
    });
    const childRoutes = children.flatMap((item) => (item.route ? [item.route] : []));
    const meta = mergeMeta(source.meta, node, false);

    return {
      top: false,

      route:
        childRoutes.length > 0
          ? ({
              path: source.path,
              name: source.name,
              component: source.component,
              meta,
              redirect: resolveRedirect(node, children, path),
              children: childRoutes,
            } as RouteRecordRaw)
          : undefined,
      menu: { path: source.path, name: source.name, meta, children: children.map((item) => item.menu) },
    };
  }

  if (source.isLayout) {
    console.warn(`[router] 菜单「${node.meta.title}」是页面，但前端 ${path} 是 layout 壳，已跳过。`);
    return null;
  }

  const buttons = (node.children ?? []).filter((child) => child.type === "button");
  const meta = mergeMeta(source.meta, node, false);

  return {
    top: topPage,
    route: {
      path: source.path,
      name: source.name,
      component: source.component,
      meta,

      props: { ...(source.props ?? {}), menu: node, buttons },
    } as RouteRecordRaw,
    menu: { path: source.path, name: source.name, meta },
  };
}

function mergeMeta(base: RouteMeta, node: AuthMenuNode, external: boolean): RouteMeta {
  const meta: RouteMeta = { ...base };
  if (node.meta.title) meta.title = node.meta.title;

  if (external) {
    meta.target = true;
    return meta;
  }

  const flags = ["keepAlive", "isScreen", "hidden", "target"] as const;
  for (const key of flags) {
    const value = node.meta[key];
    if (typeof value === "boolean") meta[key] = value;
  }
  return meta;
}

function resolveRedirect(node: AuthMenuNode, children: BuiltNode[], parentAbs: string): string | undefined {
  const visible = new Set(collectPagePaths(children.map((item) => item.menu)));
  const configured = node.meta.redirect ? resolveMenuPath(parentAbs, node.meta.redirect) : "";

  if (configured && visible.has(configured)) return configured;
  return collectPagePaths(children.map((item) => item.menu))[0];
}

function collectPagePaths(menus: AppMenuNode[]): string[] {
  const paths: string[] = [];
  const walk = (nodes: AppMenuNode[]) => {
    for (const node of nodes) {
      if (node.children?.length) {
        walk(node.children);
        continue;
      }
      if (!node.external) paths.push(node.path);
    }
  };
  walk(menus);
  return paths;
}
