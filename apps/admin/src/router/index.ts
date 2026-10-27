// 这个文件是路由的入口文件 负责创建路由实例 并导出所有的路由模块

export * from "vue-router";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import system from "./modules/system";

const keepAlive = true; // 是否缓存当前页面
const hidden = true; // 是否隐藏当前目录
const isScreen = true; // 是否占满mainApp的内容
const target = true; // 显示在侧边目录点击是否打开一个新的标签页

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    meta: { title: "登录", keepAlive, hidden, isScreen, target },
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
    name: "Layout",
    component: () => import("@/layout/index.vue"),
    children: [...system],
  },
];

export default createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_NG),
  routes,
  strict: true,
});
