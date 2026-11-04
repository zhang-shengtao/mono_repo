import { userPinia } from "@/pinia";
import { UNAUTHORIZED_EVENT } from "@/utils/request";
import type { Router } from "vue-router";
import { normalizePath } from "./path";
import { routeRegistry } from "./registry";

const whiteList = ["/login", "/404", "/403"];

function safeRedirect(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
  return value === "/" ? "" : value;
}

function toLogin(to: string) {
  const redirect = safeRedirect(to);
  return { name: "login", query: redirect ? { redirect } : {} };
}

const title = useTitle("后台管理系统");

export default function (router: Router) {
  router.beforeEach(async (to) => {
    if (to.meta?.title) title.value = String(to.meta.title);

    const userStore = userPinia();

    if (!userStore.isLogged) {
      return whiteList.includes(to.path) ? true : toLogin(to.fullPath);
    }

    if (to.name === "login") return { path: "/" };

    if (!userStore.profile) {
      try {
        await userStore.loadProfile();
      } catch {
        userStore.reset();
        return toLogin(to.fullPath);
      }
    }

    if (!userStore.routesReady) {
      try {
        await userStore.loadRoutes();
      } catch {
        userStore.reset();
        return toLogin(to.fullPath);
      }

      return { path: to.path, query: to.query, hash: to.hash, replace: true };
    }

    if (to.name === "notFound") {
      return routeRegistry.has(normalizePath(to.path)) ? "/403" : "/404";
    }

    return true;
  });

  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    const current = router.currentRoute.value;
    userPinia().reset();
    if (current.name === "login") return;

    void router.replace(toLogin(current.fullPath)).catch(() => {});
  });

  return router;
}
