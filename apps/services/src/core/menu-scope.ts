import { and, asc, desc, eq } from "drizzle-orm";
import type { MenuMeta, MenuNode, RoleMenuScope } from "@repo/shared";
import { adminMenus } from "@/db/admin_menus";
import type { AdminUser } from "@/db/admin_user";
import { permissions } from "@/db/permissions";

export type MenuRow = typeof adminMenus.$inferSelect;

export async function transmittableMenuIds(fastify: FastifyInstance, user_id: number) {
  const rows = await fastify.db
    .select({ menus_id: permissions.menus_id })
    .from(permissions)
    .where(and(eq(permissions.user_id, user_id), eq(permissions.is_transmit, true), eq(permissions.is_disabled, false)));

  return rows.map((row) => row.menus_id);
}

export async function resolveMenuScope(fastify: FastifyInstance, operator: AdminUser): Promise<RoleMenuScope> {
  const rows = await fastify.db.select().from(adminMenus).orderBy(desc(adminMenus.sort), asc(adminMenus.menus_id));
  const nodes = rows.map(toMenuNode);

  if (operator.parent_id === 0) {
    return {
      list: buildMenuTree(nodes),
      assignable: rows.filter((row) => !row.is_disabled).map((row) => row.menus_id),
      can_transmit: true,
    };
  }

  const assignable = new Set(await transmittableMenuIds(fastify, operator.user_id));
  const parentOf = new Map(rows.map((row) => [row.menus_id, row.parent_id]));
  const visible = new Set(assignable);
  for (const menus_id of assignable) {
    let cursor = parentOf.get(menus_id) ?? 0;
    while (cursor !== 0 && !visible.has(cursor)) {
      visible.add(cursor);
      cursor = parentOf.get(cursor) ?? 0;
    }
  }

  return {
    list: buildMenuTree(nodes.filter((node) => visible.has(node.menus_id))),
    assignable: [...assignable].sort((a, b) => a - b),

    can_transmit: assignable.size > 0,
  };
}

export function toMenuNode(row: MenuRow): MenuNode {
  return {
    menus_id: row.menus_id,
    type: row.type,
    parent_id: row.parent_id,
    meta: toMenuMeta(row.meta),
    permission: row.permission ?? null,
    sort: row.sort,
    is_disabled: row.is_disabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toMenuMeta(meta: Record<string, unknown> | null): MenuMeta {
  const value = (meta ?? {}) as Record<string, unknown>;
  const title = typeof value.title === "string" && value.title.trim() ? value.title : "未命名菜单";
  return { ...value, title } as MenuMeta;
}

export function menuTitleOf(meta: Record<string, unknown> | null) {
  const title = (meta ?? {}).title;
  return typeof title === "string" && title.trim() ? title : "未命名菜单";
}

export function buildMenuTree(nodes: MenuNode[]): MenuNode[] {
  const byId = new Map(nodes.map((node) => [node.menus_id, node]));
  const roots: MenuNode[] = [];

  for (const node of nodes) {
    const parent = node.parent_id === 0 ? undefined : byId.get(node.parent_id);
    if (!parent) {
      roots.push(node);
      continue;
    }
    (parent.children ??= []).push(node);
  }
  return roots;
}
