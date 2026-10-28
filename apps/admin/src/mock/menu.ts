/**
 * 菜单 mock —— 临时数据源，后端菜单接口就绪后删除
 *
 * 只由 pinia/user.ts 引用；布局侧一律读 layout.menuTree / layout.flatMenus。
 * 新增页面时这里和 router/ 两处都要改（接后端后只剩路由一处）。
 */
import type { MenuItem } from "@/types/menu";

export const MOCK_MENU_LIST: MenuItem[] = [
  {
    path: "/dashboard",
    name: "dashboard",
    type: "page",
    meta: { title: "仪表盘", icon: "Odometer", affix: true },
  },
  {
    path: "/system",
    name: "system",
    type: "directory",
    meta: { title: "系统管理", icon: "Setting" },
    children: [
      {
        path: "/system/setting",
        name: "systemSetting",
        type: "page",
        meta: { title: "系统设置", icon: "Tools" },
      },
      {
        path: "/system/user",
        name: "systemUser",
        type: "page",
        meta: { title: "用户管理", icon: "User" },
      },
    ],
  },
];
