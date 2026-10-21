import { AppError, BusinessCode } from "@/core/app-error";
import { adminMenus } from "@/db/admin-menus";
import { code } from "@/db/code";
import { formatLogTime } from "@/utils";
import { paginate } from "@/utils/pagination";
import { and, asc, count, desc, eq, inArray, like, or } from "drizzle-orm";
import type { CodeFilterQuery, CodeListQuery, CodeUpdateBody } from "./code.schema";

export default class CodeService {
  constructor(private readonly fastify: FastifyInstance) {}

  async updateStatus(data: CodeUpdateBody) {
    const { code: codeValue, is_disabled } = data;
    const [existing] = await this.fastify.db
      .select({ code: code.code })
      .from(code)
      .where(eq(code.code, codeValue))
      .limit(1);
    if (!existing) {
      throw new AppError(BusinessCode.NOT_FOUND, "权限码不存在");
    }

    await this.fastify.db
      .update(code)
      .set({ is_disabled, updated_at: formatLogTime() })
      .where(eq(code.code, codeValue));
  }

  async list(query: CodeListQuery) {
    const keyword = `%${query.search}%`;
    const disabledFilter = query.is_disabled === "all" ? undefined : eq(code.is_disabled, query.is_disabled === "true");
    const searchFilter = query.search
      ? or(
          like(code.code, keyword),
          like(code.scope, keyword),
          like(code.name, keyword),
          like(code.description, keyword),
        )
      : undefined;
    const where = and(disabledFilter, searchFilter);

    return paginate(query, {
      list: async ({ limit, offset }) => {
        const rows = await this.fastify.db
          .select()
          .from(code)
          .where(where)
          .orderBy(desc(code.created_at), desc(code.code))
          .limit(limit)
          .offset(offset);
        const menuIds = [...new Set(rows.flatMap((item) => (item.bind_menu_id === null ? [] : [item.bind_menu_id])))];
        const menuRows =
          menuIds.length === 0
            ? []
            : await this.fastify.db.select().from(adminMenus).where(inArray(adminMenus.admin_menus_id, menuIds));
        const menuMap = new Map(menuRows.map((item) => [item.admin_menus_id, item]));

        return rows.map((item) => ({
          ...item,
          menu: item.bind_menu_id === null ? null : (menuMap.get(item.bind_menu_id) ?? null),
        }));
      },
      total: () => this.fastify.db.select({ total: count() }).from(code).where(where),
    });
  }

  async filter(query: CodeFilterQuery) {
    const where = and(
      query.is_disabled === undefined ? undefined : eq(code.is_disabled, query.is_disabled),
      query.scope === undefined ? undefined : eq(code.scope, query.scope),
      query.name === undefined ? undefined : like(code.name, `%${query.name}%`),
    );

    const list = await this.fastify.db.select().from(code).where(where).orderBy(asc(code.scope), asc(code.code));
    return { list };
  }
}
