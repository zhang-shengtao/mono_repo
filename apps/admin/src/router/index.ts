// 这个文件是路由的入口文件 负责创建路由实例 并导出所有的路由模块
//
// 结构：/login /404 /403 不挂壳；其余全部收敛到 "/" 这一个壳下的子路由，
// 避免出现两个 layout 实例（来回跳会重挂载整个壳，页签/keep-alive/滚动位置全丢）。
//
// 浏览器标题（document.title）不在这里，下一轮和登录拦截一起放到 router/guard.ts。
export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import system from "./modules/system";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    meta: { title: "登录" },
    name: "login",
    component: () => import("@/view/auth/login.vue"),
  },
  {
    path: "/404",
    alias: "/:pathMatch(.*)*",
    meta: { title: "404" },
    component: () => import("@/view/auth/404.vue"),
  },
  {
    path: "/403",
    meta: { title: "403" },
    component: () => import("@/view/auth/403.vue"),
  },
  {
    path: "/",
    component: () => import("@/layout/index.vue"),
    redirect: "/dashboard",
    children: [
      {
        path: "dashboard",
        name: "dashboard",
        meta: { title: "仪表盘", icon: "Odometer", affix: true },
        component: () => import("@/view/dashboard/index.vue"),
      },
      ...system,
      {
        // 页内刷新中转：挂在壳下面，中转时壳不会被卸载
        path: "/redirect",
        name: "Redirect",
        meta: { title: "刷新中转", hidden: true },
        component: () => import("@/view/redirect/index.vue"),
      },
    ],
  },
];

export default createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes,
  strict: true,
});
