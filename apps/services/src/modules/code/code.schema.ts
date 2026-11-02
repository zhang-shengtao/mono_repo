import { codeListQuerySchema, codeListResultSchema, errorResponseSchema, responseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

/**
 * 权限码查询（只读）。
 * 菜单绑定权限码时靠它拿候选列表；写权限码留给后续的权限码管理页（system:code:put）。
 */
export const codeListRouteOptions = {
  schema: {
    tags: ["系统权限码"],
    summary: "获取权限码列表",
    description: "列出 code 表的权限码，供菜单（页面 / 按钮）绑定；bind_menu_id 非空表示已被某个菜单占用",
    querystring: codeListQuerySchema,
    response: {
      200: responseSchema(codeListResultSchema),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: { auth: "admin", permission: PERMISSIONS.SYSTEM_CODE_GET } satisfies RouteAuthConfig,
};
