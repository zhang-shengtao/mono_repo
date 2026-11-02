import { and, asc, desc, eq, ne } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type { MenuBody, MenuMeta, MenuNode, MenuTreeQuery, MenuTreeResult, MenuType, UpdateMenuBody } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminMenus } from "@/db/admin_menus";
import { code as codeTable } from "@/db/code";
import { permissions } from "@/db/permissions";

type MenuRow = typeof adminMenus.$inferSelect;

const TYPE_LABELS: Record<MenuType, string> = { directory: "目录", page: "页面", button: "按钮" };

/**
 * 菜单服务：admin_menus 的全部业务规则都收在这里。
 *
 * 三条硬规则（也是前端的表单约束）：
 *   1. directory 只做分组：不能绑定 permission，上级只能是顶级或目录；
 *   2. page 只存路由配置：上级只能是顶级或目录，子级只能是 button；
 *   3. button 即权限：必须有 permission，上级必须是 page。
 *
 * permission 与 code.bind_menu_id 是同一关系的两个方向，凡是写菜单都必须同步，否则 jwt 插件的
 * 权限校验（permissions ⋈ code.bind_menu_id）会读到漂移的数据。
 */
export default class MenuService {
  constructor(private readonly fastify: FastifyInstance) {}

  /** 菜单树：全量返回，过滤时保留命中节点的祖先链，保证树形表格不断层 */
  async tree(query: MenuTreeQuery): Promise<MenuTreeResult> {
    const rows = await this.fastify.db.select().from(adminMenus).orderBy(desc(adminMenus.sort), asc(adminMenus.menus_id));

    const keyword = query.keyword?.trim().toLowerCase() ?? "";
    const matched = rows.filter((row) => {
      if (query.type && row.type !== query.type) return false;
      if (typeof query.is_disabled === "boolean" && row.is_disabled !== query.is_disabled) return false;
      if (!keyword) return true;

      const meta = toMeta(row);
      const fields = [meta.title, meta.path ?? "", meta.name ?? "", row.permission ?? ""];
      return fields.some((value) => value.toLowerCase().includes(keyword));
    });

    return { list: buildTree(rows, keepWithAncestors(rows, matched)), total: rows.length };
  }

  /** 新增菜单：校验通过后写库，并在同一事务里把权限码反向绑到新菜单 */
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

  /**
   * 编辑菜单（整行）。
   * 表格里「启用 / 禁用」开关也走这里，前端用整行数据拼 body，服务端只认一份规则。
   */
  async update(body: UpdateMenuBody): Promise<MenuNode> {
    const current = await this.findOrFail(body.menus_id);
    const childCount = await this.countChildren(current.menus_id);
    if (childCount > 0 && body.type !== current.type) {
      throw new AppError(BusinessCode.PARAM_ERROR, `该节点下还有 ${childCount} 个子级，不能修改类型；请先调整子级`);
    }

    const validated = await this.validate(body, current);

    const updated = await this.fastify.db.transaction(async (tx) => {
      const [row] = await tx.update(adminMenus).set(validated).where(eq(adminMenus.menus_id, current.menus_id)).returning();

      // 换绑/解绑：旧码只在「确实绑在本菜单上」时解绑，避免误清别人的绑定
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

  /** 删除菜单：有子节点拒绝；成功时清理用户授权行与权限码反向绑定 */
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

  /** 统一校验 + 归一化：父级关系、权限码、meta，最后产出可直接落库的一行 */
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
    const meta = normalizeMeta(body.type, body.meta);
    await this.assertUnique(meta, selfId);

    return {
      type: body.type,
      parent_id: parentId,
      meta: meta as Record<string, unknown>,
      permission,
      sort: body.sort ?? 0,
      is_disabled: body.is_disabled ?? false,
    };
  }

  /** 父子类型矩阵：目录/页面挂顶级或目录，按钮只能挂页面 */
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

  /** 防环：沿着「上级」往上爬，撞到自己说明把节点挂进了自己的子树 */
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

  /** 权限码：目录禁绑、按钮必绑、页面可选；并且必须存在、启用中、未被别的菜单占用 */
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

    // 权限码在管理页可以被禁用；本菜单已经绑着的那个码允许原样保留（否则禁用后连菜单名称都改不了），
    // 但禁用的码不能被新绑定，也不能从别的菜单抢过来
    const keepsOwnBinding = selfId !== null && codeRow.bind_menu_id === selfId;
    if (codeRow.is_disabled && !keepsOwnBinding) throw new AppError(BusinessCode.PARAM_ERROR, `权限码 ${value} 已被禁用，不能绑定`);
    if (codeRow.bind_menu_id !== null && codeRow.bind_menu_id !== selfId) {
      throw new AppError(BusinessCode.CONFLICT, `权限码 ${value} 已绑定到「${await this.menuTitle(codeRow.bind_menu_id)}」`);
    }

    const occupied = await this.fastify.db
      .select({ menus_id: adminMenus.menus_id })
      .from(adminMenus)
      .where(selfId === null ? eq(adminMenus.permission, value) : and(eq(adminMenus.permission, value), ne(adminMenus.menus_id, selfId)))
      .limit(1);
    if (occupied.length > 0) {
      throw new AppError(BusinessCode.CONFLICT, `权限码 ${value} 已绑定到「${await this.menuTitle(occupied[0].menus_id)}」`);
    }

    return value;
  }

  /** 唯一性：目录/页面共用一套路径命名空间，页面的路由名也不能重复（keep-alive 按名字缓存） */
  private async assertUnique(meta: MenuMeta, selfId: number | null) {
    if (!meta.path && !meta.name) return;

    const rows = await this.fastify.db.select({ menus_id: adminMenus.menus_id, meta: adminMenus.meta }).from(adminMenus);
    const others = rows.filter((row) => row.menus_id !== selfId);

    if (meta.path) {
      const conflict = others.find((row) => toMeta(row).path === meta.path);
      if (conflict) throw new AppError(BusinessCode.CONFLICT, `路由路径 ${meta.path} 已被「${metaTitle(toMeta(conflict))}」占用`);
    }
    if (meta.name) {
      const conflict = others.find((row) => toMeta(row).name === meta.name);
      if (conflict) throw new AppError(BusinessCode.CONFLICT, `路由名 ${meta.name} 已被「${metaTitle(toMeta(conflict))}」占用`);
    }
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

  private async menuTitle(menus_id: number) {
    const [row] = await this.fastify.db.select({ meta: adminMenus.meta }).from(adminMenus).where(eq(adminMenus.menus_id, menus_id)).limit(1);
    return row ? metaTitle(toMeta(row)) : `菜单 ${menus_id}`;
  }
}

/** 数据库行 → 树节点（children 由 buildTree 挂） */
function toNode(row: MenuRow): MenuNode {
  return {
    menus_id: row.menus_id,
    type: row.type,
    parent_id: row.parent_id,
    meta: toMeta(row),
    permission: row.permission ?? null,
    sort: row.sort,
    is_disabled: row.is_disabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** meta 是 jsonb，历史数据可能是任意形状，读出来统一按 MenuMeta 用，缺 title 时兜底 */
function toMeta(row: Pick<MenuRow, "meta">): MenuMeta {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const title = typeof meta.title === "string" && meta.title.trim() ? meta.title : "未命名菜单";
  return { ...meta, title } as MenuMeta;
}

function metaTitle(meta: MenuMeta) {
  return meta.title || "未命名菜单";
}

/** 命中节点 + 其全部祖先，保证过滤后树仍从顶级画下来 */
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

/** 按 parent_id 组装树；同级顺序沿用查询顺序（sort desc, menus_id asc） */
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

/** 按类型裁剪 meta：只留该类型有意义的键，空值不落库；必填项在这里给出可读报错 */
function normalizeMeta(type: MenuType, meta: MenuMeta): MenuMeta {
  const title = (meta.title ?? "").trim();
  if (!title) throw new AppError(BusinessCode.PARAM_ERROR, "菜单名称不能为空");

  if (type === "button") return { title };

  const path = normalizePath(type, meta.path);
  // 重定向归目录用：目录点进去直接落到某个页面；页面的跳转由路由自己决定
  if (type === "directory") return compact({ title, path, redirect: normalizeRedirect(meta.redirect) });

  const name = (meta.name ?? "").trim();
  if (!name) throw new AppError(BusinessCode.PARAM_ERROR, "页面必须填写路由名，例如 systemMenu");
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
    throw new AppError(BusinessCode.PARAM_ERROR, "路由名必须以字母开头，只能包含字母、数字、下划线和中划线");
  }

  return compact({
    title,
    path,
    name,
    keepAlive: meta.keepAlive,
    isScreen: meta.isScreen,
    hidden: meta.hidden,
    target: meta.target,
  });
}

/** 重定向可留空；填了就必须是站内绝对路径，且去掉多余斜杠 */
function normalizeRedirect(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  if (/\s/.test(raw)) throw new AppError(BusinessCode.PARAM_ERROR, "重定向路径不能包含空格");
  if (!raw.startsWith("/")) throw new AppError(BusinessCode.PARAM_ERROR, "重定向路径必须以 / 开头，例如 /system/menu");
  return raw.replace(/\/{2,}/g, "/");
}

function normalizePath(type: MenuType, value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) throw new AppError(BusinessCode.PARAM_ERROR, `${TYPE_LABELS[type]}必须填写路由路径，例如 /system`);
  if (/\s/.test(raw)) throw new AppError(BusinessCode.PARAM_ERROR, "路由路径不能包含空格");
  if (!raw.startsWith("/")) throw new AppError(BusinessCode.PARAM_ERROR, "路由路径必须以 / 开头，例如 /system/menu");
  return raw.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

/** 丢掉 undefined / 空串，避免 jsonb 里存一堆空键 */
function compact(meta: MenuMeta): MenuMeta {
  const result: Record<string, unknown> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    result[key] = value;
  });
  return result as MenuMeta;
}
