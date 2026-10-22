/// <reference types="vite/client" />

/**
 * 环境变量类型。
 *
 * 注意：这个文件末尾有 `export {}`，它因此是一个「模块」，
 * 下面的 `declare module "vue-router"` 才是类型增强；
 * 去掉 export 会把它变成环境模块声明，直接把 vue-router 的类型覆盖成空模块。
 */
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE?: string;
    readonly VITE_PROXY_TARGET?: string;
    readonly VITE_APP_TITLE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module "vue-router" {
  interface RouteMeta {
    /** 浏览器标题 / 面包屑文案 */
    title?: string;
    /** 侧边栏图标名（@element-plus/icons-vue 的组件名） */
    icon?: string;
    /** 是否免登录访问 */
    isPublic?: boolean;
    /** 页面级权限码，来自 admin_menus.permission */
    permission?: string;
    /** 对应 admin_menus 主键，内置菜单为负数 */
    menuId?: number;
  }
}

export {};
