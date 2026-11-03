import type { RouteMeta, RouteRecordRaw } from "vue-router";
import type { AuthMenuNode } from "@repo/shared";
import { isExternal, resolveMenuPath } from "./path";
import { findRouteSource } from "./registry";

/**
 * 侧栏菜单节点。和路由记录的区别：外链没有 component、也不进路由表，但必须出现在菜单里。
 */
export interface AppMenuNode {
  path: string;
  name?: string;
  meta: RouteMeta;
  children?: AppMenuNode[];
  /** 外链：只渲染成 <a target="_blank">，不注册路由 */
  external?: boolean;
}

export interface BuildResult {
  /** 要 addRoute 的路由（不含外链、不含空壳目录） */
  routes: RouteRecordRaw[];
  /** 侧栏菜单树（含外链），交给 menuArr 拍平 */
  menuTree: AppMenuNode[];
}

/** 单个节点的构建产物：route 可能为空（外链 / 目录下全是外链） */
interface BuiltNode {
  top: boolean;
  route?: RouteRecordRaw;
  menu: AppMenuNode;
}

/**
 * 后端菜单树 → 动态路由 + 菜单树。
 *
 * 规则：
 *   1. path 两边都先补成完整路径再比对（后端 `/menu` 挂在 `/system` 下 = `/system/menu`）；
 *   2. 命中后**路由 path 一律用前端那份**，meta 前后端合并；
 *   3. 外链只进菜单，不注册路由；
 *   4. 按钮节点不生成路由，原始数据整份塞进所属页面的 props；
 *   5. 后端配了前端没有的页面 → 跳过整棵子树并 warn。
 */
export function buildRoutes(menus: AuthMenuNode[]): BuildResult {
  const routes: RouteRecordRaw[] = [];
  const menuTree: AppMenuNode[] = [];
  /** 顶级页面 / 顶级外链：统一挂到 `/` 这层 layout 壳下 */
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
      // 一个站内页面都没有（比如只配了外链）：不注册 `/` 壳，菜单照样显示
      menuTree.unshift(...loose.map((item) => item.menu));
    }
  }

  return { routes, menuTree };
}

function buildNode(node: AuthMenuNode, parentAbs: string): BuiltNode | null {
  if (node.type === "button") return null;

  const path = resolveMenuPath(parentAbs, node.meta.path);
  /** 只有顶级的「页面 / 外链」才需要套 `/` 这层壳；目录自己就是一条顶级路由 */
  const topPage = parentAbs === "";

  // 外链：只进菜单
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
      // 目录本身就是一条顶级路由，不能再套 `/` 壳（否则 layout 会渲染两层）
      top: false,
      // 子级全是外链时不注册这层壳，菜单里照样是折叠目录
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
      // 按钮节点的原始数据整份给页面，页面自己按 permission 判断
      props: { ...(source.props ?? {}), menu: node, buttons },
    } as RouteRecordRaw,
    menu: { path: source.path, name: source.name, meta },
  };
}

/**
 * meta 合并：以前端配置为底座，后端配了的字段覆盖。
 * icon / component 后端不开放，永远用前端；title 后端可改所以后端优先。
 */
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

/** 目录的 redirect：后端配的指向本次不可见的页面时，退回第一个可见的子页面 */
function resolveRedirect(node: AuthMenuNode, children: BuiltNode[], parentAbs: string): string | undefined {
  const visible = new Set(collectPagePaths(children.map((item) => item.menu)));
  const configured = node.meta.redirect ? resolveMenuPath(parentAbs, node.meta.redirect) : "";

  if (configured && visible.has(configured)) return configured;
  return collectPagePaths(children.map((item) => item.menu))[0];
}

/** 菜单树里所有「站内叶子页面」的完整路径（外链不算，不能当 redirect 目标） */
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
