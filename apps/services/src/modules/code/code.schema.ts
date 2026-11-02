import { codeItemSchema, codeListQuerySchema, codeListResultSchema, errorResponseSchema, responseSchema, updateCodeBodySchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

/** 权限码接口会主动返回的错误码：参数错、未登录、无权限、权限码不存在、服务器异常 */
const codeErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  500: errorResponseSchema,
};

/**
 * 权限码查询（只读）。
 * 菜单绑定权限码时靠它拿候选列表；权限码管理页拿全量后自己过滤。
 */
export const codeListRouteOptions = {
  schema: {
    tags: ["系统权限码"],
    summary: "获取权限码列表",
    description: "列出 code 表的权限码，供菜单（页面 / 按钮）绑定与权限码管理页展示；bind_menu_id 非空表示已被某个菜单占用",
    querystring: codeListQuerySchema,
    response: {
      200: responseSchema(codeListResultSchema),
      ...codeErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_CODE_GET } satisfies RouteAuthConfig,
};

/**
 * 修改权限码：管理页只开放「备注」和「启用 / 禁用」两件事。
 * 权限码本身随代码里的 permissions 种子维护，不提供新增 / 改名 / 删除；
 * 禁用后 jwt 插件的权限校验会立刻拦下持有该权限的账号（超管除外），恢复启用即复原。
 */
export const codeUpdateRouteOptions = {
  schema: {
    tags: ["系统权限码"],
    summary: "修改权限码（备注 / 启停）",
    description: "只接受 description 与 is_disabled：备注传 null 或空串表示清空；禁用会立刻停用对应接口权限，已绑定菜单的权限码也可以禁用",
    body: updateCodeBodySchema,
    response: {
      200: responseSchema(codeItemSchema),
      ...codeErrorResponses,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_CODE_PUT } satisfies RouteAuthConfig,
};
