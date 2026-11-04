import { z } from "zod/v4";

/**
 * 菜单（admin_menus）前后端契约。
 *
 * 表结构由 apps/services/src/db/admin_menus.ts 定义，这里只固化「接口怎么说」：
 * 服务端拿这些 schema 做请求校验 + swagger 文档，admin 端拿这些类型写页面。
 *
 * meta 是前端生成和消费的 JSON 对象，服务端只负责保存与返回，不修改其中字段。
 * 菜单类型与 permission 的业务关系仍由服务端校验。
 */

/** 菜单类型枚举（顺序即前端选项顺序） */
export const MENU_TYPES = ["directory", "page", "button"] as const;
export const menuTypeSchema = z.enum(MENU_TYPES);
export type MenuType = z.infer<typeof menuTypeSchema>;

/** 菜单元数据的已知前端字段；索引签名允许透传其他 JSON 字段。 */
export interface MenuMeta {
  [key: string]: unknown;
  title?: string;
  path?: string;
  keepAlive?: boolean;
  isScreen?: boolean;
  hidden?: boolean;
  target?: boolean;
  redirect?: string;
}

/** JSON 对象不做字段裁剪、默认值填充或类型转换，入参和出参共用此契约。 */
export const menuMetaSchema: z.ZodType<MenuMeta> = z.record(z.string(), z.unknown());

/** 菜单树节点：列表接口返回的一行 */
export interface MenuNode {
  menus_id: number;
  type: MenuType;
  parent_id: number;
  meta: MenuMeta;
  permission: string | null;
  sort: number;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
  children?: MenuNode[];
}

/** 递归的树节点 schema：children 用 getter 延迟求值，避免自引用初始化报错 */
export const menuNodeSchema: z.ZodType<MenuNode> = z.object({
  menus_id: z.number().int(),
  type: menuTypeSchema,
  parent_id: z.number().int(),
  meta: menuMetaSchema,
  permission: z.string().nullable(),
  sort: z.number().int(),
  is_disabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  get children() {
    return z.array(menuNodeSchema).optional();
  },
});

/** 菜单树查询参数 */
export const menuTreeQuerySchema = z.object({
  type: menuTypeSchema.optional().describe("按类型过滤"),
  is_disabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .describe("按启用状态过滤：true 只看已禁用，false 只看启用中"),
});
export type MenuTreeQuery = z.infer<typeof menuTreeQuerySchema>;

/** 菜单树响应 */
export interface MenuTreeResult {
  list: MenuNode[];
  total: number;
}

export const menuTreeResultSchema: z.ZodType<MenuTreeResult> = z.object({
  list: z.array(menuNodeSchema).describe("菜单树，children 为子级；过滤时保留命中节点的祖先链"),
  total: z.number().int().describe("菜单节点总数（不受过滤条件影响）"),
});

/** 新增 / 编辑菜单的请求体；meta 由前端组装，服务端原样保存 */
export const menuBodySchema = z.object({
  type: menuTypeSchema.describe("菜单类型"),
  parent_id: z.number().int().min(0).default(0).describe("上级菜单 ID；0 表示顶级"),
  meta: menuMetaSchema,
  permission: z.string().trim().max(120).nullish().describe("权限码：目录必须为空，按钮必填，页面可选"),
  sort: z.number().int().min(0).max(9999).default(0).describe("排序值，越大越靠前"),
  is_disabled: z.boolean().default(false).describe("是否禁用"),
});
export type MenuBody = z.infer<typeof menuBodySchema>;

export const createMenuBodySchema = menuBodySchema;
export type CreateMenuBody = MenuBody;

export const updateMenuBodySchema = menuBodySchema.extend({
  menus_id: z.number().int().positive().describe("要编辑的菜单 ID"),
});
export type UpdateMenuBody = z.infer<typeof updateMenuBodySchema>;

/** 单条菜单级接口的路径参数 */
export const menusIdParamsSchema = z.object({
  menus_id: z.coerce.number().int().positive().describe("菜单 ID"),
});
export type MenusIdParams = z.infer<typeof menusIdParamsSchema>;

/** 删除菜单的响应 */
export const menuDeleteResultSchema = z.object({
  menus_id: z.number().int().describe("已删除的菜单 ID"),
});
export type MenuDeleteResult = z.infer<typeof menuDeleteResultSchema>;

/** 权限码（code 表）对外投影：菜单绑定权限码时用来做下拉，权限码管理页用来展示 */
export interface CodeItem {
  code: string;
  scope: string;
  name: string;
  description: string | null;
  is_disabled: boolean;
  bind_menu_id: number | null;
  bind_menu_title: string | null;
  created_at: string;
  updated_at: string;
}

export const codeItemSchema: z.ZodType<CodeItem> = z.object({
  code: z.string().describe("权限码，如 system:menu:get"),
  scope: z.string().describe("权限作用域"),
  name: z.string().describe("权限名称"),
  description: z.string().nullable().describe("权限描述（备注），可在权限码管理页维护"),
  is_disabled: z.boolean().describe("是否禁用；禁用的权限码不能绑定，且持有该权限的账号无法调用对应接口"),
  bind_menu_id: z.number().int().nullable().describe("当前绑定的菜单 ID"),
  bind_menu_title: z.string().nullable().describe("当前绑定菜单的名称"),
  created_at: z.string().describe("创建时间"),
  updated_at: z.string().describe("最后更新时间，备注与启停都会刷新它"),
});

/** 权限码查询参数 */
export const codeListQuerySchema = z.object({
  keyword: z.string().trim().max(120).optional().describe("按权限码 / 名称 / 描述模糊搜索"),
  scope: z.string().trim().max(120).optional().describe("按作用域过滤"),
  is_disabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .describe("按启用状态过滤"),
});
export type CodeListQuery = z.infer<typeof codeListQuerySchema>;

/** 权限码列表响应 */
export interface CodeListResult {
  list: CodeItem[];
  total: number;
}

export const codeListResultSchema: z.ZodType<CodeListResult> = z.object({
  list: z.array(codeItemSchema).describe("权限码列表"),
  total: z.number().int().describe("权限码总数"),
});

/**
 * 修改权限码的请求体：只开放备注与启停。
 *
 * 权限码本身由 apps/services/src/permissions 的种子维护（新增 / 改名 / 删除都随代码走），
 * 管理页不提供增删改主键的入口，所以这里也没有 scope / name 字段。
 */
export const updateCodeBodySchema = z.object({
  code: z.string().trim().min(1).max(120).describe("要修改的权限码主键，如 system:code:get"),
  description: z.string().trim().max(255).nullish().describe("备注：传 null 或空串表示清空，不传表示不改"),
  is_disabled: z.boolean().optional().describe("是否禁用：禁用后持有该权限的账号会立刻失去对应接口的访问权限"),
});
export type UpdateCodeBody = z.infer<typeof updateCodeBodySchema>;
