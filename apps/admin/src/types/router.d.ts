/**
 * 路由 meta 类型增强（纯环境声明，不要 import 这个文件）
 *
 * 有 import 语句 => 本文件是模块 => declare module 才是「增强」而不是「重新声明」。
 */
import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    /** 页签 / 面包屑 / 菜单文字（浏览器标题下一轮由 router/guard.ts 读同一份） */
    title?: string;
    /** MyIcon 名称 */
    icon?: string;
    /** 菜单徽标 */
    badge?: string;
    /** 不进菜单 / 不进页签 */
    hidden?: boolean;
    /** 固定页签不可关闭 */
    affix?: boolean;
    /** 是否 keep-alive 缓存，默认 true */
    keepAlive?: boolean;
    /** 页面占满内容区 */
    isScreen?: boolean;
    /** 新窗口打开 */
    target?: boolean;
    /** 详情页高亮哪个菜单 */
    activeMenu?: string;
    /** 权限码占位 */
    permission?: string;
  }
}
