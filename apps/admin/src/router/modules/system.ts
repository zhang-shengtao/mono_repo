import { type RouteRecordRaw } from "vue-router";

// const keepAlive = true; // 是否缓存当前页面(keepAlive: true 表示缓存，false 表示不缓存)
// const hidden = true; // 是否隐藏当前目录菜单(有一些二级页面不需要显示在菜单中，比如:大表单或者详情页单独开一个页面的)
// const isScreen = true; // 是否占满mainApp的内容 (默认是有个一统一的内边距padding的，设置为true时二级page就会占满整个mainApp的内容区)
// const target = true; // 显示在侧边目录点击是否打开一个新的标签页

export default [
  {
    path: "/system",
    name: "system",
    meta: { title: "系统设置" },
    component: () => import("@/layout/index.vue"),
    redirect: "/system/setting",
    children: [
      {
        path: "/setting",
        name: "setting",
        meta: { title: "系统配置" },
        component: () => import("@/view/system/setting.vue"),
      },
    ],
  },
] satisfies RouteRecordRaw[];
