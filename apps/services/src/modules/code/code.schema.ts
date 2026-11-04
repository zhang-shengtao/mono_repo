import { codeItemSchema, codeListQuerySchema, codeListResultSchema, errorResponseSchema, responseSchema, updateCodeBodySchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { PERMISSIONS } from "@/permissions";

const codeErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  500: errorResponseSchema,
};

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
