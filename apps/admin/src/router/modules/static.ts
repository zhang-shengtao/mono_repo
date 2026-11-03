import type { RouteRecordRaw } from "vue-router";

// const keepAlive = true; // 是否缓存当前页面
// const hidden = true; // 是否隐藏当前目录
// const isScreen = true; // 是否占满mainApp的内容
// const target = true; // 显示在侧边目录点击是否打开一个新的标签页

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
  // 兜底（/:pathMatch(.*)*）不在这里：它必须等动态路由注册完再挂，
  // 见 router/index.ts 的 notFoundRoute 与 pinia/user.ts 的 loadRoutes()
] satisfies RouteRecordRaw[];
