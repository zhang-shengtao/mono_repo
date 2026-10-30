export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import statics from "./modules/static";
import routerRuard from "./routerRuard";

const modules = import.meta.glob<{ default: RouteRecordRaw[] }>(["./modules/*.ts", "!./modules/static.ts"], {
  eager: true,
});

export const routes = Object.values(modules).flatMap((m) => m.default);

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes: routes.concat(statics),
  strict: true,
});
routerRuard(router);
export default router;
