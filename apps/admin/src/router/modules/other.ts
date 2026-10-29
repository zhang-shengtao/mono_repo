import type { RouteRecordRaw } from "vue-router";

// const keepAlive = true; // 是否缓存当前页面
// const hidden = true; // 是否隐藏当前目录
// const isScreen = true; // 是否占满mainApp的内容
// const target = true; // 显示在侧边目录点击是否打开一个新的标签页

export default [
  {
    path: "/",
    component: () => import("@/layout/index.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        meta: { title: "仪表盘", icon: "Odometer" },
        name: "dashboard",
        component: () => import("@/view/dashboard/index.vue"),
      },
    ],
  },
] satisfies RouteRecordRaw[];
