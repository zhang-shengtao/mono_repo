import { z } from "zod/v4";
import { menuNodeSchema, type MenuNode } from "./admin-menu.js";

/**
 * 角色（roles / role_menus）前后端契约。
 *
 * 表结构由 apps/services/src/db/roles.ts、role_menus.ts 定义，这里只固化「接口怎么说」：
 * 服务端拿这些 schema 做请求校验 + swagger 文档，admin 端拿这些类型写页面。
 *
 * 角色的定位：一份可复用的权限模板。
 *   roles      角色本体（名称 / 描述 / 启停），归属人记在 created_by
 *   role_menus 角色包含哪些菜单，与用户无关 —— 所以角色建好之后才能分配给用户
 *   permissions 真正的分配关系（user_id × menus_id × roles_id），由用户管理侧维护
 *
 * 菜单粒度而不是权限码粒度：permissions 关联的是 menus_id，权限码通过 code.bind_menu_id
 * 挂在菜单上，所以「给角色勾了某个按钮」等价于「这个角色拥有那个按钮上的权限码」。
 *
 * is_transmit（可下放）：角色上的每条菜单可以标记「持有该角色的账号能否把这条菜单再下放给下级」。
 *   role_menus.is_transmit     角色模板上的标记，由超管在角色表单里维护
 *   permissions.is_transmit    真正落到某个账号身上的标记，分配 / 保存角色时从模板同步过去
 * 下放只允许一层：超管给二级管理员勾了可下放的菜单，二级管理员只能把这些菜单分配给他的下级，
 * 但不能再继续勾「可下放」，所以这条链不会无限往下传。
 */

/** 角色列表 / 详情的一行 */
export interface RoleItem {
  roles_id: number;
  roles_name: string;
  roles_description: string | null;
  is_disabled: boolean;
  menus_id: number[];
  /** menus_id 的子集：这些菜单允许持有该角色的账号再下放给下级 */
  transmit_menus_id: number[];
  user_count: number;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const roleItemSchema: z.ZodType<RoleItem> = z.object({
  roles_id: z.number().int().describe("角色 ID"),
  roles_name: z.string().describe("角色名称，同一归属人下不重复"),
  roles_description: z.string().nullable().describe("角色描述（备注）"),
  is_disabled: z.boolean().describe("是否禁用；禁用后该角色不再向持有它的账号提供权限"),
  menus_id: z.array(z.number().int()).describe("角色包含的菜单 ID，保存时已自动补齐上级"),
  transmit_menus_id: z.array(z.number().int()).describe("其中允许再下放给下级的菜单 ID（menus_id 的子集）"),
  user_count: z.number().int().describe("已分配该角色的用户数"),
  created_by: z.number().int().describe("角色归属人（创建者）的用户 ID"),
  created_by_name: z.string().nullable().describe("角色归属人的昵称"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("最后更新时间"),
});

/** 角色列表查询参数 */
export const roleListQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional().describe("按角色名称 / 描述模糊搜索"),
  is_disabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .describe("按启用状态过滤：true 只看已禁用，false 只看启用中"),
});
export type RoleListQuery = z.infer<typeof roleListQuerySchema>;

/** 角色列表响应 */
export interface RoleListResult {
  list: RoleItem[];
  total: number;
}

export const roleListResultSchema: z.ZodType<RoleListResult> = z.object({
  list: z.array(roleItemSchema).describe("角色列表"),
  total: z.number().int().describe("符合过滤条件的角色总数"),
});

/**
 * 新增 / 编辑角色的请求体。
 * menus_id 传的是「角色包含的菜单」全量集合：编辑时按它整体覆盖 role_menus，
 * 服务端会自动补齐上级菜单（只勾了按钮、没勾所在页面时，页面也会一起落库）。
 */
export const roleBodySchema = z.object({
  roles_name: z.string().trim().min(1).max(30).describe("角色名称，30 个字符以内"),
  roles_description: z.string().trim().max(255).nullish().describe("角色描述：传 null 或空串表示清空"),
  is_disabled: z.boolean().default(false).describe("是否禁用"),
  menus_id: z.array(z.number().int().positive()).default([]).describe("角色包含的菜单 ID 列表"),
  transmit_menus_id: z.array(z.number().int().positive()).default([]).describe("其中允许再下放给下级的菜单 ID（必须是 menus_id 的子集，且只能是自己手上可下放的菜单）"),
});
export type RoleBody = z.infer<typeof roleBodySchema>;

export const createRoleBodySchema = roleBodySchema;
export type CreateRoleBody = RoleBody;

export const updateRoleBodySchema = roleBodySchema.extend({
  roles_id: z.number().int().positive().describe("要编辑的角色 ID"),
});
export type UpdateRoleBody = z.infer<typeof updateRoleBodySchema>;

/** 单条角色级接口的路径参数 */
export const rolesIdParamsSchema = z.object({
  roles_id: z.coerce.number().int().positive().describe("角色 ID"),
});
export type RolesIdParams = z.infer<typeof rolesIdParamsSchema>;

/** 删除角色的响应 */
export const roleDeleteResultSchema = z.object({
  roles_id: z.number().int().describe("已删除的角色 ID"),
});
export type RoleDeleteResult = z.infer<typeof roleDeleteResultSchema>;

/**
 * 角色表单里「菜单权限」那一块的候选范围（按当前登录人算）。
 *
 * 超管（parent_id = 0）：list 是全部菜单，assignable 是全部启用中的菜单，can_transmit = true。
 * 其他管理员：只能把自己手上 is_transmit = true 的菜单再分配出去，所以 list 只含这些菜单
 * 及其祖先链（祖先只做分组，不在 assignable 里）。
 * can_transmit 表示「手上有可下放的菜单」，即能否决定把这些菜单继续往下标可下放 —— 下放可以多级，
 * 但每一级都要上一级先给。
 */
export interface RoleMenuScope {
  list: MenuNode[];
  assignable: number[];
  can_transmit: boolean;
}

export const roleMenuScopeSchema: z.ZodType<RoleMenuScope> = z.object({
  list: z.array(menuNodeSchema).describe("菜单树，可直接渲染成树形表格"),
  assignable: z.array(z.number().int()).describe("当前登录人可分配给角色的菜单 ID"),
  can_transmit: z.boolean().describe("是否能设置「可下放」：手上有可下放的菜单就为 true"),
});
