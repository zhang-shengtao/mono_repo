import type { RouteRecordRaw } from "vue-router";

// const keepAlive = true; // 是否缓存当前页面
// const hidden = true; // 是否隐藏当前目录
// const isScreen = true; // 是否占满mainApp的内容
// const target = true; // 显示在侧边目录点击是否打开一个新的标签页

export default [
  {
    path: "/system",
    name: "system",
    meta: { title: "系统管理", icon: "Setting" },
    component: () => import("@/layout/index.vue"),
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
