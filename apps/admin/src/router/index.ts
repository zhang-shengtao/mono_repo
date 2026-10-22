import { createRouter, createWebHistory } from "vue-router";
import { onUnauthorized } from "@/api/http";
import { useAuthStore } from "@/stores/auth";
import { setupGuard } from "./guard";
import { resetMenuRoutes } from "./menu-routes";
import { staticRoutes } from "./routes";

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
  scrollBehavior: () => ({ top: 0 }),
});

setupGuard(router);

/**
 * 登录态失效（任意接口 401）时统一回收：清 store、卸载动态路由、跳登录页并带上回跳地址。
 * 登录接口自己的 401 不会走到这里（见 api/http.ts）。
 */
onUnauthorized(() => {
  const auth = useAuthStore();
  auth.reset();
  resetMenuRoutes();

  const current = router.currentRoute.value;
  if (current.name === "Login") return;
  void router.replace({
    name: "Login",
    query: current.fullPath === "/" ? {} : { redirect: current.fullPath },
  });
});

export default router;
