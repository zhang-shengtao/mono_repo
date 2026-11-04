export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import statics from "./modules/static";
import routerRuard from "./routerRuard";

/** 占位兜底先参与初始匹配，动态路由加载后由守卫判断跳转 403 或 404。 */
export const notFoundRoute: RouteRecordRaw = {
  path: "/:pathMatch(.*)*",
  name: "notFound",
  component: () => import("@/view/auth/404.vue"),
};

/**
 * 路由入口：这里只注册登录 / 404 / 403 这些「不需要权限」的页面。
 * 业务路由由后端菜单驱动，登录后由 pinia/user.ts 的 loadRoutes() 动态 addRoute。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes: [...statics, notFoundRoute],
  strict: true,
});

routerRuard(router);
export default router;
