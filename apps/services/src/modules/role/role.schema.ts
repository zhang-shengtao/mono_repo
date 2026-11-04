import {
  createRoleBodySchema,
  errorResponseSchema,
  responseSchema,
  roleDeleteResultSchema,
  roleItemSchema,
  roleListQuerySchema,
  roleListResultSchema,
  roleMenuScopeSchema,
  rolesIdParamsSchema,
  updateRoleBodySchema,
} from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

const roleErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

export const roleListRouteOptions = {
  schema: {
    tags: ["系统角色"],
    summary: "获取角色列表",
    description: "列出角色及其菜单集合（menus_id）与已分配用户数（user_count），供角色管理页展示与编辑回填；可见范围按归属人算：超管看全部，其他管理员只看自己创建的角色",
    querystring: roleListQuerySchema,
    response: {
      200: responseSchema(roleListResultSchema),
      ...roleErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_ROLE_GET } satisfies RouteAuthConfig,
};

export const roleMenuScopeRouteOptions = {
  schema: {
    tags: ["系统角色"],
    summary: "获取角色可分配的菜单",
    description: "按当前登录人返回角色表单可选的菜单树（list）、真正可勾选的菜单 ID（assignable）以及能否设置「可下放」（can_transmit）",
    response: {
      200: responseSchema(roleMenuScopeSchema),
      ...roleErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_ROLE_GET } satisfies RouteAuthConfig,
};

export const roleCreateRouteOptions = {
  schema: {
    tags: ["系统角色"],
    summary: "新增角色",
    description: "创建角色并配置菜单集合；menus_id 会自动补齐上级菜单，已禁用的菜单不能新分配；transmit_menus_id 标记其中哪些允许再下放（仅超管可设）",
    body: createRoleBodySchema,
    response: {
      200: responseSchema(roleItemSchema),
      ...roleErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_ROLE_ADD } satisfies RouteAuthConfig,
};

export const roleUpdateRouteOptions = {
  schema: {
    tags: ["系统角色"],
    summary: "编辑角色",
    description: "整行编辑：名称 / 描述 / 菜单集合 / 可下放集合 / 启停。menus_id 按全量覆盖，减掉的菜单会同步清理用户的对应授权，可下放标记同步到 permissions",
    body: updateRoleBodySchema,
    response: {
      200: responseSchema(roleItemSchema),
      ...roleErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_ROLE_PUT } satisfies RouteAuthConfig,
};

export const roleDeleteRouteOptions = {
  schema: {
    tags: ["系统角色"],
    summary: "删除角色",
    description: "删除角色，并清理 role_menus 与 permissions 里该角色的分配记录；已分配给用户的权限会随之失效",
    params: rolesIdParamsSchema,
    response: {
      200: responseSchema(roleDeleteResultSchema),
      ...roleErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_ROLE_DELETE } satisfies RouteAuthConfig,
};
