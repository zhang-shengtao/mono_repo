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

/** 角色接口会主动返回的错误码：参数错、未登录、无权限、角色不存在、名称冲突、服务器异常 */
const roleErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

/**
 * 角色列表（只读）。
 * 角色是有限集合（几十个），一次拉全量、前端本地过滤；服务端仍支持 keyword / is_disabled，
 * 供其他调用方按需使用。每行带上 role_menus 的菜单 ID 与 permissions 的已分配用户数。
 */
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

/**
 * 角色表单的菜单候选范围（只读）。
 * 超管拿到全量菜单且 can_transmit = true；二级管理员只拿到自己「可下放」的菜单，can_transmit = false。
 */
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

/**
 * 新增角色：先写 roles，再在同一事务里写 role_menus。
 * 角色的归属人取当前登录人（created_by），同一归属人下角色名不重复。
 */
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

/**
 * 编辑角色：整行覆盖。
 * 表格里的「启用 / 禁用」开关也走这里，前端用整行数据拼 body，服务端只认一份规则。
 * 角色减掉的菜单，会同时收回已经分配给用户的对应权限；transmit_menus_id 会同步到 permissions.is_transmit。
 */
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

/** 删除角色：一并清理 role_menus 与该角色的分配关系（permissions） */
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
