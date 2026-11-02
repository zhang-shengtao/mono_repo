import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type { CodeItem, CodeListQuery, CodeListResult, UpdateCodeBody } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminMenus } from "@/db/admin_menus";
import { code as codeTable } from "@/db/code";

/**
 * code 表的对外投影。
 * 列表与「修改后回读」共用同一份 select：bind_menu_title 从 admin_menus.meta 里取标题，
 * 绑定关系的真相是 code.bind_menu_id，菜单侧 admin_menus.permission 由 MenuService 同步维护。
 */
const codeColumns = {
  code: codeTable.code,
  scope: codeTable.scope,
  name: codeTable.name,
  description: codeTable.description,
  is_disabled: codeTable.is_disabled,
  bind_menu_id: codeTable.bind_menu_id,
  bind_menu_title: sql<string | null>`${adminMenus.meta} ->> 'title'`,
  created_at: codeTable.created_at,
  updated_at: codeTable.updated_at,
};

/** 修改权限码时允许落库的两列；备注空串统一收成 null，避免库里同时存在 "" 和 NULL 两种空 */
interface CodeChanges {
  description?: string | null;
  is_disabled?: boolean;
}

export default class CodeService {
  constructor(private readonly fastify: FastifyInstance) {}

  /**
   * 权限码列表。
   * leftJoin 出「已被哪个菜单占用」，前端下拉才能把占用的码置灰并说明原因。
   */
  async list(query: CodeListQuery): Promise<CodeListResult> {
    const filters: SQL[] = [];

    const keyword = query.keyword?.trim();
    if (keyword) {
      const like = `%${keyword}%`;
      const matched = or(ilike(codeTable.code, like), ilike(codeTable.name, like), ilike(codeTable.description, like));
      if (matched) filters.push(matched);
    }
    if (query.scope) filters.push(eq(codeTable.scope, query.scope));
    if (typeof query.is_disabled === "boolean") filters.push(eq(codeTable.is_disabled, query.is_disabled));

    const rows = await this.fastify.db
      .select(codeColumns)
      .from(codeTable)
      .leftJoin(adminMenus, eq(codeTable.bind_menu_id, adminMenus.menus_id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(codeTable.scope), asc(codeTable.code));

    return { list: rows satisfies CodeItem[], total: rows.length };
  }

  /**
   * 修改权限码：只认备注（description）与启停（is_disabled）。
   *
   * 这里不拦「已绑定菜单的码」：绑定关系本身不受启停影响，jwt 插件的权限校验读的是
   * code.is_disabled = false，禁用即停用接口、恢复启用即可复原，正是本页要提供的操作。
   * 权限码主键 / 名称 / 作用域由 permissions 种子维护，接口不开对应字段。
   */
  async update(body: UpdateCodeBody): Promise<CodeItem> {
    const changes = pickChanges(body);
    if (!changes) throw new AppError(BusinessCode.PARAM_ERROR, "没有需要保存的改动：只能修改备注或启用状态");

    const [existing] = await this.fastify.db.select({ code: codeTable.code }).from(codeTable).where(eq(codeTable.code, body.code)).limit(1);
    if (!existing) throw new AppError(BusinessCode.NOT_FOUND, `权限码 ${body.code} 不存在，请刷新后重试`);

    await this.fastify.db.update(codeTable).set(changes).where(eq(codeTable.code, body.code));

    const [row] = await this.fastify.db
      .select(codeColumns)
      .from(codeTable)
      .leftJoin(adminMenus, eq(codeTable.bind_menu_id, adminMenus.menus_id))
      .where(eq(codeTable.code, body.code))
      .limit(1);

    return row satisfies CodeItem;
  }
}

/** 只挑出允许改的两列：字段没传 = 不改，备注传空串 / null = 清空 */
function pickChanges(body: UpdateCodeBody): CodeChanges | null {
  const changes: CodeChanges = {};

  if (body.description !== undefined) changes.description = body.description?.trim() || null;
  if (typeof body.is_disabled === "boolean") changes.is_disabled = body.is_disabled;

  return Object.keys(changes).length > 0 ? changes : null;
}
