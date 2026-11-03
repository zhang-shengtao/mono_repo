import { z } from "zod/v4";
import { adminStatusSchema, type AdminStatus } from "./admin-auth.js";
import { roleMenuScopeSchema, type RoleMenuScope } from "./admin-role.js";

/**
 * 管理员用户（admin_user）前后端契约。
 *
 * 层级模型：parent_id 指向自己的上级，parent_id = 0 是超级管理员。
 * 每个管理员只能看到 / 管理自己的**直属下级**；超管例外，能看 / 管全部账号（不含自己）。
 *
 * 权限模型（permissions）：
 *   permissions(user_id × menus_id) 一行 = 这个账号拥有这个菜单
 *   roles_id   这条授权是哪个角色给的（同一个菜单只能来自一个角色，PK 就是 user_id + menus_id）
 *   is_transmit 这条权限能不能被持有者再下放给它的下级；逐级传递，由上一级决定
 * 角色的菜单是模板（role_menus），分配给用户时落到 permissions，可以比模板少（细调）。
 */

/** 用户身上的一条角色（列表展示用，不带菜单） */
export interface UserRole {
  roles_id: number;
  roles_name: string;
}

export const userRoleSchema: z.ZodType<UserRole> = z.object({
  roles_id: z.number().int().describe("角色 ID"),
  roles_name: z.string().describe("角色名称"),
});

/** 用户列表 / 详情的一行（不含密码） */
export interface UserItem {
  user_id: number;
  parent_id: number;
  account: string;
  nickname: string;
  status: AdminStatus;
  remark: string | null;
  roles: UserRole[];
  menus_count: number;
  created_at: string;
  updated_at: string;
}

export const userItemSchema: z.ZodType<UserItem> = z.object({
  user_id: z.number().int().describe("用户 ID"),
  parent_id: z.number().int().describe("上级用户 ID"),
  account: z.string().describe("登录账号"),
  nickname: z.string().describe("昵称"),
  status: adminStatusSchema.describe("账号状态"),
  remark: z.string().nullable().describe("备注"),
  roles: z.array(userRoleSchema).describe("已分配的角色"),
  menus_count: z.number().int().describe("已分配的菜单条数（permissions 行数）"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("最后更新时间"),
});

/** 用户列表查询参数 */
export const userListQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional().describe("按账号 / 昵称模糊搜索"),
  status: adminStatusSchema.optional().describe("按状态过滤"),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export interface UserListResult {
  list: UserItem[];
  total: number;
}

export const userListResultSchema: z.ZodType<UserListResult> = z.object({
  list: z.array(userItemSchema).describe("用户列表：超管为全部账号，其他管理员为直属下级"),
  total: z.number().int().describe("符合过滤条件的用户总数"),
});

/** 新增用户：上级固定是当前登录人，不用传 parent_id */
export const createUserBodySchema = z.object({
  account: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "账号以字母开头，只能包含字母、数字、下划线和中划线")
    .describe("登录账号，全局唯一"),
  nickname: z.string().trim().min(1).max(50).describe("昵称"),
  password: z.string().min(6).max(128).describe("初始密码，6 至 128 个字符"),
  remark: z.string().trim().max(255).nullish().describe("备注"),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

/** 编辑用户：账号不可改，密码留空表示不修改 */
export const updateUserBodySchema = z.object({
  user_id: z.number().int().positive().describe("要编辑的用户 ID"),
  nickname: z.string().trim().min(1).max(50).describe("昵称"),
  password: z.string().min(6).max(128).nullish().describe("新密码；不传或空串表示不修改"),
  status: z.enum(["normal", "disabled"]).describe("账号状态"),
  remark: z.string().trim().max(255).nullish().describe("备注：传 null 或空串表示清空"),
});
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

/** 单条用户级接口的路径参数 */
export const userIdParamsSchema = z.object({
  user_id: z.coerce.number().int().positive().describe("用户 ID"),
});
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

/** 删除用户的响应 */
export const userDeleteResultSchema = z.object({
  user_id: z.number().int().describe("已删除的用户 ID"),
});
export type UserDeleteResult = z.infer<typeof userDeleteResultSchema>;

/** 权限弹窗里的角色选项：带上该角色的菜单，前端据此算候选菜单 */
export interface RoleOption {
  roles_id: number;
  roles_name: string;
  menus_id: number[];
}

export const roleOptionSchema: z.ZodType<RoleOption> = z.object({
  roles_id: z.number().int().describe("角色 ID"),
  roles_name: z.string().describe("角色名称"),
  menus_id: z.array(z.number().int()).describe("该角色包含的菜单 ID"),
});

/** 用户身上的一条授权 */
export interface UserMenuGrant {
  menus_id: number;
  roles_id: number;
  is_transmit: boolean;
}

export const userMenuGrantSchema: z.ZodType<UserMenuGrant> = z.object({
  menus_id: z.number().int().describe("菜单 ID"),
  roles_id: z.number().int().describe("这条授权来自哪个角色"),
  is_transmit: z.boolean().describe("是否允许该用户再下放给它的下级"),
});

/**
 * 用户权限详情。
 * roles 是「可分配的角色」，scope 是「可分配的菜单范围」，两者都由当前登录人算：
 * 超管看全部，二级管理员只看自己建的角色的菜单、且必须是手上 is_transmit = true 的那部分。
 */
export interface UserPermissionDetail {
  user_id: number;
  roles_id: number[];
  menus: UserMenuGrant[];
  roles: RoleOption[];
  scope: RoleMenuScope;
}

export const userPermissionDetailSchema: z.ZodType<UserPermissionDetail> = z.object({
  user_id: z.number().int().describe("用户 ID"),
  roles_id: z.array(z.number().int()).describe("已分配的角色 ID"),
  menus: z.array(userMenuGrantSchema).describe("已分配的菜单及其来源角色"),
  roles: z.array(roleOptionSchema).describe("当前登录人可分配给该用户的角色"),
  scope: roleMenuScopeSchema.describe("可分配的菜单范围与能否设置可下放"),
});

/**
 * 保存用户权限：按全量覆盖处理。
 * menus_id 必须落在所选角色的菜单并集里；roles_id 用来给每条授权定位来源角色
 * （同一菜单被多个角色覆盖时，取 roles_id 里靠前的那个）。
 */
export const userPermissionBodySchema = z.object({
  user_id: z.number().int().positive().describe("目标用户 ID"),
  roles_id: z.array(z.number().int().positive()).default([]).describe("分配给该用户的角色 ID 列表"),
  menus_id: z.array(z.number().int().positive()).default([]).describe("分配给该用户的菜单 ID 列表"),
  transmit_menus_id: z.array(z.number().int().positive()).default([]).describe("其中允许再下放的菜单 ID（只能是自己手上可下放的菜单）"),
});
export type UserPermissionBody = z.infer<typeof userPermissionBodySchema>;
