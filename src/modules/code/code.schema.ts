import { PERMISSIONS } from "@/permissions";
import { responseSchema, errorResponseSchema } from "@/utils";
import { z } from "zod/v4";

const codeValueSchema = z.string().trim().min(1).max(120).describe("权限编码");
const codeResponseBaseSchema = z.object({
  code: codeValueSchema,
  scope: z.string().trim().min(1).max(120).describe("权限分组"),
  name: z.string().trim().min(1).max(120).describe("权限名称"),
  is_disabled: z.boolean().describe("是否禁用"),
  description: z.string().trim().max(255).nullable().default(null).describe("权限描述"),
});

const codeUpdateBodySchema = z.object({
  code: codeValueSchema,
  is_disabled: z.boolean().describe("是否禁用"),
});

const codeResponseSchema = codeResponseBaseSchema.extend({
  bind_menu_id: z.number().int().nullable().describe("绑定的菜单 ID"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("更新时间"),
});

const codeBoundMenuResponseSchema = z.object({
  admin_menus_id: z.number().int().describe("菜单 ID"),
  type: z.enum(["directory", "page", "button"]).describe("菜单类型"),
  parent_id: z.number().int().describe("父级菜单 ID"),
  meta: z.record(z.string(), z.unknown()).describe("菜单元数据"),
  permission: z.string().nullable().describe("菜单权限码"),
  sort: z.number().int().describe("排序值"),
  is_disabled: z.boolean().describe("菜单是否禁用"),
  created_at: z.string().describe("菜单创建时间"),
  updated_at: z.string().describe("菜单更新时间"),
});

const codeListItemResponseSchema = codeResponseSchema.extend({
  menu: codeBoundMenuResponseSchema.nullable().describe("权限码绑定的菜单，未绑定时为 null"),
});

const emptyResponseSchema = responseSchema(z.object({}));
const commonErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
};

export type CodeUpdateBody = z.infer<typeof codeUpdateBodySchema>;
export type CodeListQuery = z.infer<typeof codeListQuerySchema>;
export type CodeFilterQuery = z.infer<typeof codeFilterQuerySchema>;

export const codeUpdateRouteOptions = {
  schema: {
    tags: ["权限码"],
    summary: "修改权限码状态",
    body: codeUpdateBodySchema,
    response: { 200: emptyResponseSchema, ...commonErrorResponses },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_CODE_PUT,
  },
};

const codeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("页码"),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe("每页数量"),
  search: z.string().trim().default("").describe("按编码、分组、名称或描述搜索"),
  is_disabled: z.enum(["all", "true", "false"]).default("all").describe("是否禁用筛选"),
});

export const codeListRouteOptions = {
  schema: {
    tags: ["权限码"],
    summary: "查询权限码列表",
    querystring: codeListQuerySchema,
    response: {
      200: responseSchema(
        z.object({
          list: z.array(codeListItemResponseSchema),
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
        }),
      ),
      ...commonErrorResponses,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_CODE_GET,
  },
};

const codeFilterQuerySchema = z.object({
  is_disabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .describe("是否禁用，true 为禁用，false 为启用"),
  scope: z.string().trim().min(1).max(120).optional().describe("权限分组，精确筛选"),
  name: z.string().trim().min(1).max(120).optional().describe("权限名称，模糊筛选"),
});

export const codeFilterRouteOptions = {
  schema: {
    tags: ["权限码"],
    summary: "筛选权限码",
    description: "不分页，仅支持按启禁状态、权限分组和权限名称筛选",
    querystring: codeFilterQuerySchema,
    response: {
      200: responseSchema(z.object({ list: z.array(codeResponseSchema) })),
      ...commonErrorResponses,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_CODE_GET,
  },
};
