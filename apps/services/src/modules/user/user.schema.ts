import { PERMISSIONS } from "@/permissions";
import { errorResponseSchema, responseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { z } from "zod/v4";

const userStatus = z.enum(["normal", "disabled", "deleted"]);
const editableUserStatus = z.enum(["normal", "disabled"]);

const userResponseSchema = z.object({
  user_id: z.number().int().describe("用户 ID"),
  parent_id: z.number().int().min(0).describe("直属父级用户 ID"),
  account: z.string().describe("用户账号"),
  nickname: z.string().describe("用户昵称"),
  status: userStatus.describe("用户状态"),
  created_by: z.number().int().nullable().describe("创建人 ID"),
  remark: z.string().nullable().describe("备注"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("更新时间"),
  deleted_at: z.string().nullable().describe("删除时间"),
});

const userAddBodySchema = z.object({
  account: z.string().trim().min(3).max(50).describe("用户账号，3 至 50 个字符"),
  nickname: z.string().trim().min(1).max(50).describe("用户昵称"),
  password: z.string().min(6).max(128).describe("登录密码，6 至 128 个字符"),
  remark: z.string().trim().max(255).nullable().default(null).describe("备注"),
});

const userUpdateBodySchema = z.object({
  user_id: z.number().int().min(1).describe("用户 ID"),
  nickname: z.string().trim().min(1).max(50).describe("用户昵称"),
  status: editableUserStatus.describe("用户状态"),
  password: z.string().min(6).max(128).optional().describe("新登录密码，不传则不修改"),
  remark: z.string().trim().max(255).nullable().default(null).describe("备注"),
});

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("页码"),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe("每页数量"),
  search: z.string().trim().default("").describe("按账号、昵称或备注搜索"),
  status: z.enum(["all", "normal", "disabled"]).default("all").describe("用户状态筛选"),
});

const userPermissionBodySchema = z.object({
  user_id: z.number().int().min(1).describe("用户 ID"),
  permissions: z
    .array(
      z.object({
        admin_menus_id: z.number().int().min(1).describe("菜单 ID"),
        is_transmit: z.boolean().default(false).describe("是否允许继续转授给下级账号"),
      }),
    )
    .max(1000)
    .describe("用户权限列表"),
});

const userPermissionItemResponseSchema = z.object({
  admin_menus_id: z.number().int().describe("菜单 ID"),
  type: z.enum(["directory", "page", "button"]).describe("菜单类型"),
  parent_id: z.number().int().describe("父级菜单 ID"),
  meta: z.record(z.string(), z.unknown()).describe("菜单元数据"),
  permission: z.string().nullable().describe("权限码"),
  sort: z.number().int().describe("排序值"),
  granted: z.boolean().describe("目标用户是否已拥有该权限"),
  is_transmit: z.boolean().describe("是否允许目标用户继续转授"),
});

const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

export type UserAddBody = z.infer<typeof userAddBodySchema>;
export type UserUpdateBody = z.infer<typeof userUpdateBodySchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserPermissionBody = z.infer<typeof userPermissionBodySchema>;

export const userAddRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "新增直属子账号",
    body: userAddBodySchema,
    response: {
      200: responseSchema(z.object({ user_id: z.number().int().describe("新增用户 ID") })),
      ...commonErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_ADD } satisfies RouteAuthConfig,
};

export const userUpdateRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "修改直属子账号",
    body: userUpdateBodySchema,
    response: { 200: responseSchema(z.object({})), ...commonErrorResponses },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PUT } satisfies RouteAuthConfig,
};

export const userListRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "查询直属子账号列表",
    querystring: userListQuerySchema,
    response: {
      200: responseSchema(
        z.object({
          list: z.array(userResponseSchema),
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
        }),
      ),
      ...commonErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_GET } satisfies RouteAuthConfig,
};

export const userDeleteRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "删除直属子账号",
    description: "软删除没有下级账号的直属子账号，并清空其权限和登录会话",
    params: z.object({ user_id: z.coerce.number().int().min(1).describe("用户 ID") }),
    response: { 200: responseSchema(z.object({})), ...commonErrorResponses },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_DELETE } satisfies RouteAuthConfig,
};

export const userPermissionGetRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "查询直属子账号的可分配权限",
    params: z.object({ user_id: z.coerce.number().int().min(1).describe("用户 ID") }),
    response: {
      200: responseSchema(z.object({ list: z.array(userPermissionItemResponseSchema) })),
      ...commonErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PERMISSION_GET } satisfies RouteAuthConfig,
};

export const userPermissionPutRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "设置直属子账号权限",
    body: userPermissionBodySchema,
    response: { 200: responseSchema(z.object({})), ...commonErrorResponses },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PERMISSION_PUT } satisfies RouteAuthConfig,
};

export const userInfoRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "获取当前管理员详情",
    response: { 200: responseSchema(userResponseSchema), ...commonErrorResponses },
  },
  config: { auth: "admin" } satisfies RouteAuthConfig,
};

export const userLogoutRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "管理员退出登录",
    response: { 200: responseSchema(z.object({})), ...commonErrorResponses },
  },
  config: { auth: "admin" } satisfies RouteAuthConfig,
};

export const userLoginRouteOptions = {
  schema: {
    tags: ["管理员用户"],
    summary: "管理员登录",
    body: z.object({
      username: z.string().min(1).describe("管理员用户名"),
      password: z.string().min(6).max(128).describe("管理员密码"),
      code: z.string().min(1).max(3).describe("验证码"),
      captcha_id: z.string().min(1).describe("验证码 ID"),
    }),
    response: {
      200: responseSchema(z.object({ token: z.string().describe("管理员访问令牌") })),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: { auth: "public" } satisfies RouteAuthConfig,
};
