export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const modules = import.meta.glob<{ default: RouteRecordRaw[] }>("./modules/*.ts", {
  eager: true,
});

export const routes = Object.values(modules).flatMap((m) => m.default);

export default createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes,
  strict: true,
});
