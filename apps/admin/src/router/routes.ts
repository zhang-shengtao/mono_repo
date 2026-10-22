/**
 * 路由表。
 *
 * 静态部分：登录页、外壳布局、仪表盘、403 / 404。
 * 动态部分：数据库里 type === "page" 的菜单，由 installMenuRoutes 在登录后挂到 Root 下。
 *
 * 组件匹配顺序（见 menu-routes.ts）：meta.component → meta.path → 内置组件表 → MissingPage。
 * 所以新建菜单时 meta.name / meta.path 只要和下面 pageRegistry 的键对上，就能直接渲染。
 */
import type { Component } from "vue";
import type { RouteRecordRaw } from "vue-router";
import AdminLayout from "@/layouts/AdminLayout.vue";

export type PageLoader = () => Promise<Component>;

export const pageRegistry: Record<string, PageLoader> = {
  dashboard: () => import("@/views/dashboard/index.vue").then((module) => module.default),
  "dashboard/index": () => import("@/views/dashboard/index.vue").then((module) => module.default),
  "system/user": () => import("@/views/system/user/index.vue").then((module) => module.default),
  "system/user/index": () => import("@/views/system/user/index.vue").then((module) => module.default),
  "system/menu": () => import("@/views/system/menu/index.vue").then((module) => module.default),
  "system/menu/index": () => import("@/views/system/menu/index.vue").then((module) => module.default),
  "system/code": () => import("@/views/system/code/index.vue").then((module) => module.default),
  "system/code/index": () => import("@/views/system/code/index.vue").then((module) => module.default),
};

export const staticRoutes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue").then((module) => module.default),
    meta: { title: "登录", isPublic: true },
  },
  {
    path: "/",
    name: "Root",
    component: AdminLayout,
    redirect: "/dashboard",
    children: [
      {
        path: "/dashboard",
        name: "Dashboard",
        component: () => import("@/views/dashboard/index.vue").then((module) => module.default),
        meta: { title: "仪表盘", icon: "Odometer" },
      },
    ],
  },
  {
    path: "/403",
    name: "Forbidden",
    component: () => import("@/views/error/Forbidden.vue").then((module) => module.default),
    meta: { title: "无访问权限", isPublic: true },
  },
  {
    // 兜底放在最后；动态菜单路由在登录后 addRoute，优先于它匹配
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/error/NotFound.vue").then((module) => module.default),
    meta: { title: "页面不存在", isPublic: true },
  },
];
