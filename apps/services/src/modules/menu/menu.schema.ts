import {
  createMenuBodySchema,
  errorResponseSchema,
  menuDeleteResultSchema,
  menuNodeSchema,
  menuTreeQuerySchema,
  menuTreeResultSchema,
  menusIdParamsSchema,
  responseSchema,
  updateMenuBodySchema,
} from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

const menuErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

export const menuTreeRouteOptions = {
  schema: {
    tags: ["系统菜单"],
    summary: "获取菜单树",
    description: "返回全部菜单的树形结构（目录 → 页面 → 按钮）。带过滤条件时，命中节点的祖先链会一并返回，保证树不断层",
    querystring: menuTreeQuerySchema,
    response: {
      200: responseSchema(menuTreeResultSchema),
      ...menuErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_MENU_GET } satisfies RouteAuthConfig,
};

export const menuCreateRouteOptions = {
  schema: {
    tags: ["系统菜单"],
    summary: "新增菜单",
    description: "校验菜单层级与权限码关系；meta JSON 由前端组装，服务端原样保存。写入时同步 code.bind_menu_id",
    body: createMenuBodySchema,
    response: {
      200: responseSchema(menuNodeSchema),
      ...menuErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_MENU_ADD } satisfies RouteAuthConfig,
};

export const menuUpdateRouteOptions = {
  schema: {
    tags: ["系统菜单"],
    summary: "编辑菜单",
    description: "整行编辑：服务端校验类型 / 上级 / 权限码 / 排序 / 状态，meta JSON 原样保存。已有子节点时不允许修改类型；换绑权限码会同步 code.bind_menu_id",
    body: updateMenuBodySchema,
    response: {
      200: responseSchema(menuNodeSchema),
      ...menuErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_MENU_PUT } satisfies RouteAuthConfig,
};

export const menuDeleteRouteOptions = {
  schema: {
    tags: ["系统菜单"],
    summary: "删除菜单",
    description: "有子节点时拒绝删除；成功时一并清理 permissions 里的用户授权与 code.bind_menu_id 反向绑定",
    params: menusIdParamsSchema,
    response: {
      200: responseSchema(menuDeleteResultSchema),
      ...menuErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_MENU_DELETE } satisfies RouteAuthConfig,
};
