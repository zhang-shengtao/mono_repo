import type { RouteRecordRaw } from "vue-router";

export default [
  {
    path: "/",
    component: () => import("@/layout/index.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        meta: { title: "仪表盘", icon: "Odometer", keepAlive: true },
        name: "dashboard",
        component: () => import("@/view/dashboard/index.vue"),
      },
    ],
  },
] satisfies RouteRecordRaw[];
