import { PERMISSIONS, PERMISSION_CODES } from "@/permissions";
import { responseSchema, errorResponseSchema } from "@/utils";
import { z } from "zod/v4";

const menuBodySchema = z.object({
  type: z.enum(["directory", "page", "button"]).describe("菜单类型: directory目录，page页面，button按钮"),
  parent_id: z.number().int().min(0).default(0).describe("父级菜单ID，顶级菜单为0"),
  meta: z.record(z.string(), z.unknown()).default({}).describe("菜单元数据，JSON对象，服务端仅存储"),
  permission: z.enum(PERMISSION_CODES).nullable().default(null).describe("权限标识，可为空"),
  sort: z.number().int().min(0).default(0).describe("排序值，数字越小越靠前"),
  is_disabled: z.boolean().default(false).describe("是否禁用"),
});
export type MenuBody = z.infer<typeof menuBodySchema>;

const menuUpdateBodySchema = menuBodySchema.extend({
  admin_menus_id: z.number().int().min(1).describe("菜单ID"),
});

export type MenuUpdateBody = z.infer<typeof menuUpdateBodySchema>;

const menuResponseSchema = menuUpdateBodySchema.extend({
  permission: z.string().nullable().describe("权限标识"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("更新时间"),
});

const menuTreeResponseSchema: z.ZodType = menuResponseSchema.extend({
  children: z.lazy(() => z.array(menuTreeResponseSchema)).describe("子菜单列表或者菜单下按钮的列表"),
});

export const menuAddRouteOptions = {
  schema: {
    tags: ["菜单相关"],
    summary: "新增菜单",
    description: "新增菜单",
    body: menuBodySchema.extend({
      children: z.lazy(() => z.array(menuBodySchema)).describe("子菜单列表或者菜单下按钮的列表"),
    }),
    response: {
      200: responseSchema(
        z.object({
          admin_menus_id: z.number().int().min(1).describe("新增菜单 ID"),
        }),
      ),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      409: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_MENU_ADD,
  },
};

export const menuUpdateRouteOptions = {
  schema: {
    tags: ["菜单相关"],
    summary: "修改菜单",
    description: "修改菜单",
    body: menuUpdateBodySchema,
    response: {
      200: responseSchema(z.object({})),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      404: errorResponseSchema,
      409: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_MENU_PUT,
  },
};

export const menuListRouteOptions = {
  schema: {
    tags: ["菜单相关"],
    summary: "查询菜单",
    description: "查询菜单列表",
    querystring: z.object({
      search: z.string().trim().default("").describe("搜索关键字"),
    }),
    response: {
      200: responseSchema(
        z.object({
          list: z.array(menuTreeResponseSchema).describe("菜单树列表"),
        }),
      ),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_MENU_GET,
  },
};

export const menuCurrentUserRouteOptions = {
  schema: {
    tags: ["菜单相关"],
    summary: "查询当前用户菜单",
    description: "查询当前登录用户可访问的菜单，并自动补齐父级目录",
    response: {
      200: responseSchema(
        z.object({
          list: z.array(menuTreeResponseSchema).describe("当前用户可访问的菜单树"),
        }),
      ),
      401: errorResponseSchema,
      403: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
};

export const menuDeleteRouteOptions = {
  schema: {
    tags: ["菜单相关"],
    summary: "删除菜单",
    description: "物理删除菜单及其全部子菜单",
    params: z.object({
      admin_menus_id: z.coerce.number().int().min(1).describe("菜单ID"),
    }),
    response: {
      200: responseSchema(z.object({})),
      400: errorResponseSchema,
      401: errorResponseSchema,
      403: errorResponseSchema,
      404: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    permission: PERMISSIONS.SYSTEM_MENU_DELETE,
  },
};
