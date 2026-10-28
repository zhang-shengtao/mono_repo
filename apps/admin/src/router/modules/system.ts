/**
 * 系统管理子路由（纯子路由导出，不再自带 layout 壳）
 *
 * 挂载点见 router/index.ts 的 "/" 路由 children：全站只有这一个壳实例。
 */
import type { RouteRecordRaw } from "vue-router";

export default [
  {
    path: "/system",
    name: "system",
    meta: { title: "系统管理", icon: "Setting" },
    redirect: "/system/setting",
    children: [
      {
        path: "setting",
        name: "systemSetting",
        meta: { title: "系统设置", icon: "Tools" },
        component: () => import("@/view/system/setting.vue"),
      },
      {
        path: "user",
        name: "systemUser",
        meta: { title: "用户管理", icon: "User" },
        component: () => import("@/view/system/user.vue"),
      },
    ],
  },
] satisfies RouteRecordRaw[];
