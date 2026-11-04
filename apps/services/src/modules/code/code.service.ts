import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type { CodeItem, CodeListQuery, CodeListResult, UpdateCodeBody } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminMenus } from "@/db/admin_menus";
import { code as codeTable } from "@/db/code";

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

interface CodeChanges {
  description?: string | null;
  is_disabled?: boolean;
}

export default class CodeService {
  constructor(private readonly fastify: FastifyInstance) {}

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

  async update(body: UpdateCodeBody): Promise<CodeItem> {
    const changes = pickChanges(body);
    if (!changes) throw new AppError(BusinessCode.PARAM_ERROR, "没有需要保存的改动：只能修改备注或启用状态");

    const [existing] = await this.fastify.db.select({ code: codeTable.code }).from(codeTable).where(eq(codeTable.code, body.code)).limit(1);
    if (!existing) throw new AppError(BusinessCode.NOT_FOUND, `权限码 ${body.code} 不存在，请刷新后重试`);

    await this.fastify.db.update(codeTable).set(changes).where(eq(codeTable.code, body.code));

    const [row] = await this.fastify.db.select(codeColumns).from(codeTable).leftJoin(adminMenus, eq(codeTable.bind_menu_id, adminMenus.menus_id)).where(eq(codeTable.code, body.code)).limit(1);

    return row satisfies CodeItem;
  }
}

function pickChanges(body: UpdateCodeBody): CodeChanges | null {
  const changes: CodeChanges = {};

  if (body.description !== undefined) changes.description = body.description?.trim() || null;
  if (typeof body.is_disabled === "boolean") changes.is_disabled = body.is_disabled;

  return Object.keys(changes).length > 0 ? changes : null;
}
