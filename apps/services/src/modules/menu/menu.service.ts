import { and, asc, desc, eq, ne } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type { AdminRouteResult, AuthMenuNode, MenuBody, MenuMeta, MenuNode, MenuTreeQuery, MenuTreeResult, MenuType, UpdateMenuBody } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminMenus } from "@/db/admin_menus";
import type { AdminUser } from "@/db/admin_user";
import { code as codeTable } from "@/db/code";
import { permissions } from "@/db/permissions";

type MenuRow = typeof adminMenus.$inferSelect;

const TYPE_LABELS: Record<MenuType, string> = { directory: "目录", page: "页面", button: "按钮" };

export default class MenuService {
  constructor(private readonly fastify: FastifyInstance) {}

  async tree(query: MenuTreeQuery): Promise<MenuTreeResult> {
    const rows = await this.fastify.db.select().from(adminMenus).orderBy(desc(adminMenus.sort), asc(adminMenus.menus_id));
    const matched = rows.filter((row) => {
      if (query.type && row.type !== query.type) return false;
      if (typeof query.is_disabled === "boolean" && row.is_disabled !== query.is_disabled) return false;
      return true;
    });

    return { list: buildTree(rows, keepWithAncestors(rows, matched)), total: rows.length };
  }

  async routesFor(operator: AdminUser): Promise<AdminRouteResult> {
    const rows = await this.fastify.db.select().from(adminMenus).orderBy(desc(adminMenus.sort), asc(adminMenus.menus_id));
    const active = rows.filter((row) => !row.is_disabled);
    const activeById = new Map(active.map((row) => [row.menus_id, row]));

    let visible: Set<number>;
    if (operator.parent_id === 0) {
      visible = new Set(active.map((row) => row.menus_id));
    } else {
      const grants = await this.fastify.db
        .select({ menus_id: permissions.menus_id })
        .from(permissions)
        .where(and(eq(permissions.user_id, operator.user_id), eq(permissions.is_disabled, false)));
      visible = withAncestors(
        grants.map((row) => row.menus_id),
        activeById,
      );
    }

    return { list: buildRouteTree(active.filter((row) => visible.has(row.menus_id))) };
  }

  async create(body: MenuBody): Promise<MenuNode> {
    const validated = await this.validate(body, null);

    const created = await this.fastify.db.transaction(async (tx) => {
      const [row] = await tx.insert(adminMenus).values(validated).returning();
      if (row.permission) {
        await tx.update(codeTable).set({ bind_menu_id: row.menus_id }).where(eq(codeTable.code, row.permission));
      }
      return row;
    });

    return toNode(created);
  }

  async update(body: UpdateMenuBody): Promise<MenuNode> {
    const current = await this.findOrFail(body.menus_id);
    const childCount = await this.countChildren(current.menus_id);
    if (childCount > 0 && body.type !== current.type) {
      throw new AppError(BusinessCode.PARAM_ERROR, `该节点下还有 ${childCount} 个子级，不能修改类型；请先调整子级`);
    }

    const validated = await this.validate(body, current);

    const updated = await this.fastify.db.transaction(async (tx) => {
      const [row] = await tx.update(adminMenus).set(validated).where(eq(adminMenus.menus_id, current.menus_id)).returning();

      if (current.permission && current.permission !== row.permission) {
        await tx
          .update(codeTable)
          .set({ bind_menu_id: null })
          .where(and(eq(codeTable.code, current.permission), eq(codeTable.bind_menu_id, current.menus_id)));
      }
      if (row.permission) {
        await tx.update(codeTable).set({ bind_menu_id: row.menus_id }).where(eq(codeTable.code, row.permission));
      }
      return row;
    });

    return toNode(updated);
  }

  async remove(menus_id: number): Promise<{ menus_id: number }> {
    await this.findOrFail(menus_id);

    const childCount = await this.countChildren(menus_id);
    if (childCount > 0) {
      throw new AppError(BusinessCode.CONFLICT, `该菜单下还有 ${childCount} 个子级，请先删除子级`);
    }

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.menus_id, menus_id));
      await tx.update(codeTable).set({ bind_menu_id: null }).where(eq(codeTable.bind_menu_id, menus_id));
      await tx.delete(adminMenus).where(eq(adminMenus.menus_id, menus_id));
    });

    return { menus_id };
  }

  private async validate(body: MenuBody, current: MenuRow | null) {
    const selfId = current?.menus_id ?? null;
    const parentId = body.parent_id ?? 0;

    if (selfId !== null && parentId === selfId) {
      throw new AppError(BusinessCode.PARAM_ERROR, "上级菜单不能是自己");
    }

    const parent = parentId === 0 ? null : await this.findOrFail(parentId, "上级菜单不存在，请刷新后重试", BusinessCode.PARAM_ERROR);
    this.assertParentType(body.type, parent);

    if (selfId !== null && parentId !== 0) await this.assertNoCycle(selfId, parentId);

    const permission = await this.resolvePermission(body.type, body.permission ?? null, selfId);

    return {
      type: body.type,
      parent_id: parentId,
      meta: body.meta,
      permission,
      sort: body.sort ?? 0,
      is_disabled: body.is_disabled ?? false,
    };
  }

  private assertParentType(type: MenuType, parent: MenuRow | null) {
    if (type === "button") {
      if (!parent) throw new AppError(BusinessCode.PARAM_ERROR, "按钮必须挂在页面下，请选择上级页面");
      if (parent.type !== "page") {
        throw new AppError(BusinessCode.PARAM_ERROR, `按钮只能挂在页面下，当前上级是${TYPE_LABELS[parent.type]}`);
      }
      return;
    }

    if (!parent) return;
    if (parent.type !== "directory") {
      throw new AppError(BusinessCode.PARAM_ERROR, `${TYPE_LABELS[type]}只能挂在顶级或目录下，当前上级是${TYPE_LABELS[parent.type]}`);
    }
  }

  private async assertNoCycle(selfId: number, parentId: number) {
    const rows = await this.fastify.db.select({ menus_id: adminMenus.menus_id, parent_id: adminMenus.parent_id }).from(adminMenus);
    const parentOf = new Map(rows.map((row) => [row.menus_id, row.parent_id]));

    const visited = new Set<number>();
    let cursor: number | undefined = parentId;
    while (cursor !== undefined && cursor !== 0 && !visited.has(cursor)) {
      if (cursor === selfId) throw new AppError(BusinessCode.PARAM_ERROR, "不能把菜单挂到自己的子级下");
      visited.add(cursor);
      cursor = parentOf.get(cursor);
    }
  }

  private async resolvePermission(type: MenuType, permission: string | null, selfId: number | null): Promise<string | null> {
    const value = permission?.trim() || null;

    if (type === "directory") {
      if (value) throw new AppError(BusinessCode.PARAM_ERROR, "目录只做分组，不能绑定权限码");
      return null;
    }
    if (!value) {
      if (type === "button") throw new AppError(BusinessCode.PARAM_ERROR, "按钮必须绑定权限码");
      return null;
    }

    const [codeRow] = await this.fastify.db.select().from(codeTable).where(eq(codeTable.code, value)).limit(1);
    if (!codeRow) throw new AppError(BusinessCode.PARAM_ERROR, `权限码 ${value} 不存在，请先在权限码管理里创建`);

    const keepsOwnBinding = selfId !== null && codeRow.bind_menu_id === selfId;
    if (codeRow.is_disabled && !keepsOwnBinding) throw new AppError(BusinessCode.PARAM_ERROR, `权限码 ${value} 已被禁用，不能绑定`);
    if (codeRow.bind_menu_id !== null && codeRow.bind_menu_id !== selfId) {
      throw new AppError(BusinessCode.CONFLICT, `权限码 ${value} 已绑定到菜单 ${codeRow.bind_menu_id}`);
    }

    const occupied = await this.fastify.db
      .select({ menus_id: adminMenus.menus_id })
      .from(adminMenus)
      .where(selfId === null ? eq(adminMenus.permission, value) : and(eq(adminMenus.permission, value), ne(adminMenus.menus_id, selfId)))
      .limit(1);
    if (occupied.length > 0) {
      throw new AppError(BusinessCode.CONFLICT, `权限码 ${value} 已绑定到菜单 ${occupied[0].menus_id}`);
    }

    return value;
  }

  private async findOrFail(menus_id: number, message = "菜单不存在，请刷新后重试", code: BusinessCode = BusinessCode.NOT_FOUND): Promise<MenuRow> {
    const [row] = await this.fastify.db.select().from(adminMenus).where(eq(adminMenus.menus_id, menus_id)).limit(1);
    if (!row) throw new AppError(code, message);
    return row;
  }

  private async countChildren(menus_id: number) {
    const rows = await this.fastify.db.select({ menus_id: adminMenus.menus_id }).from(adminMenus).where(eq(adminMenus.parent_id, menus_id));
    return rows.length;
  }
}

function toNode(row: MenuRow): MenuNode {
  return {
    menus_id: row.menus_id,
    type: row.type,
    parent_id: row.parent_id,
    meta: row.meta as MenuMeta,
    permission: row.permission ?? null,
    sort: row.sort,
    is_disabled: row.is_disabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function keepWithAncestors(rows: MenuRow[], matched: MenuRow[]) {
  const parentOf = new Map(rows.map((row) => [row.menus_id, row.parent_id]));
  const keep = new Set<number>();

  for (const row of matched) {
    let cursor: number | undefined = row.menus_id;
    while (cursor !== undefined && cursor !== 0 && !keep.has(cursor)) {
      keep.add(cursor);
      cursor = parentOf.get(cursor);
    }
  }
  return keep;
}

function buildTree(rows: MenuRow[], keep: Set<number>): MenuNode[] {
  const visible = rows.filter((row) => keep.has(row.menus_id));
  const nodes = new Map<number, MenuNode>();
  visible.forEach((row) => nodes.set(row.menus_id, toNode(row)));

  const roots: MenuNode[] = [];
  for (const row of visible) {
    const node = nodes.get(row.menus_id)!;
    const parent = row.parent_id === 0 ? undefined : nodes.get(row.parent_id);
    if (!parent) {
      roots.push(node);
      continue;
    }
    (parent.children ??= []).push(node);
  }
  return roots;
}

function withAncestors(menus_id: number[], activeById: Map<number, MenuRow>) {
  const visible = new Set<number>();
  const granted = new Set(menus_id);

  for (const id of menus_id) {
    if (!activeById.has(id)) continue;

    const chain: number[] = [];
    let cursor: number | undefined = id;
    let reachable = true;
    while (cursor !== undefined && cursor !== 0) {
      const row = activeById.get(cursor);
      if (!row) {
        reachable = false;
        break;
      }
      if (cursor !== id && row.type !== "directory" && !granted.has(cursor)) {
        reachable = false;
        break;
      }
      chain.push(cursor);
      cursor = row.parent_id;
    }

    if (reachable) chain.forEach((item) => visible.add(item));
  }

  return visible;
}

function toAuthNode(row: MenuRow): AuthMenuNode {
  return {
    menus_id: row.menus_id,
    type: row.type,
    parent_id: row.parent_id,
    meta: row.meta as MenuMeta,
    permission: row.permission ?? null,
    sort: row.sort,
  };
}

function buildRouteTree(rows: MenuRow[]): AuthMenuNode[] {
  const nodes = new Map<number, AuthMenuNode>();
  rows.forEach((row) => nodes.set(row.menus_id, toAuthNode(row)));

  const roots: AuthMenuNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.menus_id)!;
    const parent = row.parent_id === 0 ? undefined : nodes.get(row.parent_id);
    if (!parent) {
      roots.push(node);
      continue;
    }
    (parent.children ??= []).push(node);
  }
  return roots;
}
