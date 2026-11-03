import { z } from "zod/v4";
import { menuMetaSchema, menuTypeSchema, type MenuMeta, type MenuType } from "./admin-menu.js";

/**
 * 「我的菜单」（GET /admin/auth/routes）前后端契约。
 *
 * 和 admin-menu.ts 的 MenuNode 的区别：这里是**按登录人过滤后**的菜单，只保留前端渲染需要的字段
 * （去掉 created_at / updated_at / is_disabled —— 能下发的都是启用中的），并且包含按钮节点：
 * 前端拿它构建动态路由（目录 / 页面）和按钮权限（按钮节点的原始数据会原样塞进路由的 props）。
 *
 * meta.path 允许两种形态：
 *   站内路径  /system/menu   前端用它去路由索引里匹配组件
 *   外链      https://x.com  前端不注册路由，只作为菜单项渲染成 <a target="_blank">
 */
export interface AuthMenuNode {
  menus_id: number;
  type: MenuType;
  parent_id: number;
  meta: MenuMeta;
  /** 绑定的权限码：页面可选、按钮必填；按钮的权限码就是「按钮权限」 */
  permission: string | null;
  sort: number;
  children?: AuthMenuNode[];
}

export const authMenuNodeSchema: z.ZodType<AuthMenuNode> = z.object({
  menus_id: z.number().int().describe("菜单 ID"),
  type: menuTypeSchema.describe("菜单类型：目录 / 页面 / 按钮"),
  parent_id: z.number().int().describe("上级菜单 ID，0 表示顶级"),
  meta: menuMetaSchema.describe("菜单元数据；path 可能是站内路径，也可能是外链"),
  permission: z.string().nullable().describe("绑定的权限码；按钮节点的权限码就是按钮权限"),
  sort: z.number().int().describe("排序值，越大越靠前"),
  get children() {
    return z.array(authMenuNodeSchema).optional();
  },
});

/** GET /admin/auth/routes 的响应 */
export interface AdminRouteResult {
  list: AuthMenuNode[];
}

export const adminRouteResultSchema: z.ZodType<AdminRouteResult> = z.object({
  list: z.array(authMenuNodeSchema).describe("当前登录人可见的菜单树，已按 sort desc、menus_id asc 排序"),
});
