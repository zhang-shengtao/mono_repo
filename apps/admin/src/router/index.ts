export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { normalizePath } from "./path";
import { routeRegistry } from "./registry";
import statics from "./modules/static";
import routerRuard from "./routerRuard";

/**
 * 路由入口：这里只注册登录 / 404 / 403 这些「不需要权限」的页面。
 * 业务路由由后端菜单驱动，登录后由 pinia/user.ts 的 loadRoutes() 动态 addRoute。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes: statics,
  strict: true,
});

/**
 * 兜底路由：必须等动态路由都注册完再挂，否则刷新时先命中它。
 * 命中的地址在前端路由表里存在 = 有页面但没权限 → /403；否则 → /404。
 */
export const notFoundRoute: RouteRecordRaw = {
  path: "/:pathMatch(.*)*",
  name: "notFound",
  redirect: (to) => (routeRegistry.has(normalizePath(to.path)) ? "/403" : "/404"),
};

routerRuard(router);
export default router;
