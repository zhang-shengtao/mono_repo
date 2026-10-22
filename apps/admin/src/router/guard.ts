/**
 * 路由守卫：登录拦截 → 首次进入初始化 → 页面级权限校验。
 */
import type { Router } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { installMenuRoutes } from "./menu-routes";

const APP_TITLE = import.meta.env.VITE_APP_TITLE || "管理后台";

export function setupGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore();
    document.title = to.meta.title ? `${to.meta.title} · ${APP_TITLE}` : APP_TITLE;

    if (to.meta.isPublic) {
      // 已登录还去登录页 → 回到首页
      if (to.name === "Login" && auth.token) return auth.homePath;
      return true;
    }

    if (!auth.token) {
      return { name: "Login", query: to.fullPath === "/" ? {} : { redirect: to.fullPath } };
    }

    // 首次进入（或刷新）：先拉账号和菜单，再把动态路由挂上，然后重新走一遍这次导航
    if (!auth.ready) {
      try {
        await auth.bootstrap();
      } catch {
        auth.reset();
        return { name: "Login", query: { redirect: to.fullPath } };
      }
      installMenuRoutes(router, auth.menus);
      return to.fullPath;
    }

    if (to.meta.permission && !auth.can(to.meta.permission)) return { name: "Forbidden" };
    return true;
  });
}
