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

const userErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

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
