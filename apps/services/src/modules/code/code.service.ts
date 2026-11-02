import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { CodeItem, CodeListQuery, CodeListResult } from "@repo/shared";
import { adminMenus } from "@/db/admin_menus";
import { code as codeTable } from "@/db/code";

export default class CodeService {
  constructor(private readonly fastify: FastifyInstance) {}

  /**
   * 权限码列表。
   * 顺带 leftJoin 出「已被哪个菜单占用」，前端下拉才能把占用的码置灰并说明原因；
   * 绑定关系的真相是 code.bind_menu_id，菜单侧 admin_menus.permission 与它由 MenuService 同步维护。
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
      .select({
        code: codeTable.code,
        scope: codeTable.scope,
        name: codeTable.name,
        description: codeTable.description,
        is_disabled: codeTable.is_disabled,
        bind_menu_id: codeTable.bind_menu_id,
        bind_menu_title: sql<string | null>`${adminMenus.meta} ->> 'title'`,
      })
      .from(codeTable)
      .leftJoin(adminMenus, eq(codeTable.bind_menu_id, adminMenus.menus_id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(codeTable.scope), asc(codeTable.code));

    return { list: rows satisfies CodeItem[], total: rows.length };
  }
}
