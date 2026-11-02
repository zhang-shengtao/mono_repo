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

/** 菜单接口会主动返回的错误码：参数错、未登录、无权限、菜单不存在、路径/权限码冲突 */
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
    description: "按 type 校验结构：目录只做分组（permission 必须为空）；页面只存路由配置，子级只能是按钮；按钮必须绑定权限码。写入时同步 code.bind_menu_id",
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
    description: "整行编辑：类型 / 上级 / meta / 权限码 / 排序 / 状态。已有子节点时不允许修改类型；换绑权限码会同步 code.bind_menu_id",
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
