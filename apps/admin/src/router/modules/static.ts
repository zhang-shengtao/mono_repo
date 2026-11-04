import type { RouteRecordRaw } from "vue-router";

export default [
  {
    path: "/login",
    meta: { title: "登录", hidden: true },
    name: "login",
    component: () => import("@/view/auth/login.vue"),
  },
  {
    path: "/404",
    meta: { title: "404", hidden: true },
    component: () => import("@/view/auth/404.vue"),
  },
  {
    path: "/403",
    meta: { title: "403", hidden: true },
    component: () => import("@/view/auth/403.vue"),
  },
] satisfies RouteRecordRaw[];
