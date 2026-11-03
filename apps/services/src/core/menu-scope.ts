import { and, asc, desc, eq } from "drizzle-orm";
import type { MenuMeta, MenuNode, RoleMenuScope } from "@repo/shared";
import { adminMenus } from "@/db/admin_menus";
import type { AdminUser } from "@/db/admin_user";
import { permissions } from "@/db/permissions";

/**
 * 「谁能分配哪些菜单」的唯一实现，角色表单和用户授权共用。
 *
 * 规则：
 *   超管（parent_id = 0）          全量菜单可分配，且可以决定是否可下放
 *   其他管理员                     只能分配自己 permissions 里 is_transmit = true 且未禁用的菜单，
 *                                  祖先链补齐只用于树形展示（祖先只做分组，不可勾选）
 *
 * 下放可以多级，但每一级都由上一级决定：可下放标记只能打在「自己手上 is_transmit = true」的菜单上，
 * 所以上级没给你可下放，你就传不下去；给了，你才有资格决定要不要继续传。
 * 换句话说 can_transmit 不是「超管专属开关」，而是「手上有可下放菜单」的同义词。
 */

export type MenuRow = typeof adminMenus.$inferSelect;

/** 当前登录人手上允许继续下放的菜单（permissions.is_transmit = true 且未禁用） */
export async function transmittableMenuIds(fastify: FastifyInstance, user_id: number) {
  const rows = await fastify.db
    .select({ menus_id: permissions.menus_id })
    .from(permissions)
    .where(and(eq(permissions.user_id, user_id), eq(permissions.is_transmit, true), eq(permissions.is_disabled, false)));

  return rows.map((row) => row.menus_id);
}

/** 角色表单 / 用户授权弹窗的菜单候选范围 */
export async function resolveMenuScope(fastify: FastifyInstance, operator: AdminUser): Promise<RoleMenuScope> {
  const rows = await fastify.db.select().from(adminMenus).orderBy(desc(adminMenus.sort), asc(adminMenus.menus_id));
  const nodes = rows.map(toMenuNode);

  if (operator.parent_id === 0) {
    return {
      // 全部菜单都摆出来（已禁用的也显示，方便看到现有的），但只有启用中的能新分配
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
    // 手上有可下放的菜单，就能决定「传下去时要不要继续保持可下放」—— 多级下放靠这一条串起来
    can_transmit: assignable.size > 0,
  };
}

/** 数据库行 → 树节点（children 由 buildMenuTree 挂） */
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

/** meta 是 jsonb，历史数据可能是任意形状，读出来统一按 MenuMeta 用，缺 title 时兜底 */
export function toMenuMeta(meta: Record<string, unknown> | null): MenuMeta {
  const value = (meta ?? {}) as Record<string, unknown>;
  const title = typeof value.title === "string" && value.title.trim() ? value.title : "未命名菜单";
  return { ...value, title } as MenuMeta;
}

/** 菜单标题存在 meta jsonb 里，历史数据可能是任意形状，缺 title 时兜底 */
export function menuTitleOf(meta: Record<string, unknown> | null) {
  const title = (meta ?? {}).title;
  return typeof title === "string" && title.trim() ? title : "未命名菜单";
}

/** 按 parent_id 组装树；同级顺序沿用查询顺序（sort desc, menus_id asc） */
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
