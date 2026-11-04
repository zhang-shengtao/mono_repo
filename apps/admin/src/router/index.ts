export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import statics from "./modules/static";
import routerRuard from "./routerRuard";

export const notFoundRoute: RouteRecordRaw = {
  path: "/:pathMatch(.*)*",
  name: "notFound",
  component: () => import("@/view/auth/404.vue"),
};

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes: [...statics, notFoundRoute],
  strict: true,
});

routerRuard(router);
export default router;
