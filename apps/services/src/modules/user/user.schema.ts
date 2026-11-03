import {
  createUserBodySchema,
  errorResponseSchema,
  responseSchema,
  updateUserBodySchema,
  userDeleteResultSchema,
  userIdParamsSchema,
  userItemSchema,
  userListQuerySchema,
  userListResultSchema,
  userPermissionBodySchema,
  userPermissionDetailSchema,
} from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

/** 用户接口会主动返回的错误码：参数错、未登录、无权限、不存在、账号冲突、服务器异常 */
const userErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

/**
 * 用户列表。
 * 超管看全部（不含自己），其他管理员只看 parent_id = 当前登录人 的账号；
 * 一次拉全量、前端本地过滤（账号数量有限）。
 */
export const userListRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "获取用户列表",
    description: "超管列出全部账号，其他管理员只列出 parent_id 为自己 的直属下级；附上已分配角色（roles）与菜单条数（menus_count）",
    querystring: userListQuerySchema,
    response: {
      200: responseSchema(userListResultSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_GET } satisfies RouteAuthConfig,
};

/** 新增直属下级：parent_id 固定取当前登录人，账号全局唯一 */
export const userCreateRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "新增直属下级用户",
    description: "创建 parent_id 为当前登录人的账号，初始状态正常；密码用 argon2id 哈希后落库",
    body: createUserBodySchema,
    response: {
      200: responseSchema(userItemSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_ADD } satisfies RouteAuthConfig,
};

/** 编辑直属下级：账号不可改，密码留空表示不修改；禁用会立刻踢掉该账号的会话 */
export const userUpdateRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "编辑直属下级用户",
    description: "改昵称 / 备注 / 状态 / 密码。状态置为 disabled 时会清掉该账号在 Redis 里的全部会话",
    body: updateUserBodySchema,
    response: {
      200: responseSchema(userItemSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PUT } satisfies RouteAuthConfig,
};

/** 删除直属下级：软删除，并清掉该账号的授权与会话；有下级时拒绝 */
export const userDeleteRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "删除直属下级用户",
    description: "软删除（status = deleted）并清理 permissions；该账号下还有下级时拒绝删除",
    params: userIdParamsSchema,
    response: {
      200: responseSchema(userDeleteResultSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_DELETE } satisfies RouteAuthConfig,
};

/**
 * 用户权限详情。
 * 同时下发「可分配的角色」和「可分配的菜单范围」，前端一个请求就能画出权限弹窗。
 */
export const userPermissionGetRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "获取用户权限",
    description: "返回该用户已分配的角色与菜单（含 is_transmit），以及当前登录人可分配的角色和菜单范围",
    params: userIdParamsSchema,
    response: {
      200: responseSchema(userPermissionDetailSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PERMISSION_GET } satisfies RouteAuthConfig,
};

/**
 * 保存用户权限：全量覆盖 permissions。
 * 菜单必须落在所选角色的菜单并集里；非超管还必须落在自己 is_transmit = true 的范围内。
 */
export const userPermissionPutRouteOptions = {
  schema: {
    tags: ["系统用户"],
    summary: "分配用户权限",
    description: "按全量覆盖写 permissions：roles_id 决定每条授权的来源角色，transmit_menus_id 决定哪些允许该用户继续下放（仅超管可设）",
    body: userPermissionBodySchema,
    response: {
      200: responseSchema(userPermissionDetailSchema),
      ...userErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_PERMISSION_PUT } satisfies RouteAuthConfig,
};
