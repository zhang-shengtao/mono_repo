import { and, asc, eq, ilike, inArray, ne, notInArray, or, type SQL } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type { CreateRoleBody, RoleItem, RoleListQuery, RoleListResult, RoleMenuScope, UpdateRoleBody } from "@repo/shared";
import { menuTitleOf, resolveMenuScope, transmittableMenuIds } from "@/core/menu-scope";
import { AppError } from "@/core/app_error";
import { adminMenus } from "@/db/admin_menus";
import { adminUser, type AdminUser } from "@/db/admin_user";
import { permissions } from "@/db/permissions";
import { roleMenus } from "@/db/role_menus";
import { roles } from "@/db/roles";

/**
 * 角色表的对外投影。
 * created_by_name 从 admin_user 里取昵称：角色的归属人（创建者）是这个表唯一的「人」，
 * 页面列表要显示他，否则光有 ID 没法认。
 */
const roleColumns = {
  roles_id: roles.roles_id,
  roles_name: roles.roles_name,
  roles_description: roles.roles_description,
  is_disabled: roles.is_disabled,
  created_by: roles.created_by,
  created_by_name: adminUser.nickname,
  created_at: roles.created_at,
  updated_at: roles.updated_at,
};

/** 编辑时用来放行「本来就在角色里、后来被禁用 / 被收回下放权」的菜单 */
interface RoleContext {
  roles_id: number;
  created_by: number;
  menus_id: number[];
}

/** 角色的一条菜单：是否允许再下放由 is_transmit 决定 */
interface RoleMenuValue {
  menus_id: number;
  is_transmit: boolean;
}

/** 角色 → 菜单集合（menus 是全量，transmit 是其中可下放的那部分） */
interface RoleMenuSet {
  menus: number[];
  transmit: number[];
}

/**
 * 角色服务：roles + role_menus 的业务规则都收在这里。
 *
 * 四条硬规则：
 *   1. 角色是模板，与用户无关 —— 菜单集合存 role_menus，分配关系存 permissions；
 *   2. 同一归属人下角色名不重复（不同管理员可以有同名角色）；
 *   3. 角色的菜单集合按全量覆盖处理：编辑时减掉的菜单，要同步收回用户身上由该角色授予的权限，
 *      否则会出现「角色里没有这个菜单，用户却还留着」的漂移数据；
 *   4. is_transmit（可下放）逐级传递：谁能把某条菜单标成「可下放」，取决于他自己手上有没有这条菜单的
 *      可下放权 —— 上级给了，你才有资格决定要不要继续往下传；没给，就到此为止。
 *      落库时 role_menus 与 permissions 上的标记保持一致，permissions 才是鉴权时读的那份。
 */
export default class RoleService {
  constructor(private readonly fastify: FastifyInstance) {}

  /**
   * 角色列表：全量返回，附上菜单集合、可下放集合与已分配用户数。
   * 可见范围按归属人算：超管看全部，其他管理员只看自己建的角色
   * （和 user.service 的 assignableRoles 同一套口径，否则会看到一堆自己既不能分配也不能改的模板）。
   */
  async list(query: RoleListQuery, operator: AdminUser): Promise<RoleListResult> {
    const filters: SQL[] = [];
    if (operator.parent_id !== 0) filters.push(eq(roles.created_by, operator.user_id));

    const keyword = query.keyword?.trim();
    if (keyword) {
      const like = `%${keyword}%`;
      const matched = or(ilike(roles.roles_name, like), ilike(roles.roles_description, like));
      if (matched) filters.push(matched);
    }
    if (typeof query.is_disabled === "boolean") filters.push(eq(roles.is_disabled, query.is_disabled));

    const rows = await this.fastify.db
      .select(roleColumns)
      .from(roles)
      .leftJoin(adminUser, eq(roles.created_by, adminUser.user_id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(asc(roles.roles_id));

    const [menuRows, assignedRows] = await Promise.all([
      this.fastify.db.select({ roles_id: roleMenus.roles_id, menus_id: roleMenus.menus_id, is_transmit: roleMenus.is_transmit }).from(roleMenus),
      this.fastify.db.select({ roles_id: permissions.roles_id, user_id: permissions.user_id }).from(permissions),
    ]);

    const menusByRole = groupMenus(menuRows);
    const usersByRole = groupUsers(assignedRows);

    return {
      list: rows.map((row) => {
        const menuSet = menusByRole.get(row.roles_id);
        return {
          ...row,
          menus_id: menuSet?.menus ?? [],
          transmit_menus_id: menuSet?.transmit ?? [],
          user_count: usersByRole.get(row.roles_id)?.size ?? 0,
        };
      }),
      total: rows.length,
    };
  }

  /** 新增角色：roles 与 role_menus 同一事务写入，避免出现「有角色没菜单」的中间态 */
  async create(body: CreateRoleBody, operator: AdminUser): Promise<RoleItem> {
    const values = await this.normalize(body, null, operator);

    const created = await this.fastify.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(roles)
        .values({
          roles_name: values.roles_name,
          roles_description: values.roles_description,
          is_disabled: values.is_disabled,
          created_by: operator.user_id,
          updated_by: operator.user_id,
        })
        .returning({ roles_id: roles.roles_id });

      if (values.menus.length > 0) {
        await tx.insert(roleMenus).values(values.menus.map((item) => ({ roles_id: row.roles_id, ...item })));
      }

      return row;
    });

    return this.detail(created.roles_id);
  }

  /** 编辑角色（整行）：菜单集合全量覆盖，并把角色已不包含的菜单从用户授权里收回 */
  async update(body: UpdateRoleBody, operator: AdminUser): Promise<RoleItem> {
    const current = await this.findOrFail(body.roles_id, operator);
    const currentMenus = await this.menuIdsOf(current.roles_id);
    const values = await this.normalize(body, { ...current, menus_id: currentMenus }, operator);
    const menus_id = values.menus.map((item) => item.menus_id);
    const transmit = values.menus.filter((item) => item.is_transmit).map((item) => item.menus_id);

    await this.fastify.db.transaction(async (tx) => {
      await tx
        .update(roles)
        .set({
          roles_name: values.roles_name,
          roles_description: values.roles_description,
          is_disabled: values.is_disabled,
          updated_by: operator.user_id,
        })
        .where(eq(roles.roles_id, current.roles_id));

      await tx.delete(roleMenus).where(eq(roleMenus.roles_id, current.roles_id));
      if (values.menus.length > 0) {
        await tx.insert(roleMenus).values(values.menus.map((item) => ({ roles_id: current.roles_id, ...item })));
      }

      // 角色不再包含的菜单：用户身上由这个角色授予的权限一并删掉，不留孤儿授权
      await tx
        .delete(permissions)
        .where(menus_id.length > 0 ? and(eq(permissions.roles_id, current.roles_id), notInArray(permissions.menus_id, menus_id)) : eq(permissions.roles_id, current.roles_id));

      // 角色新增的菜单：补给已经持有这个角色的账号。
      // 页面上写的是「改一次菜单，所有持有该角色的账号同步生效」，只删不补就只兑现了一半。
      await this.grantAddedMenus(tx, current.roles_id, menus_id, new Set(transmit), operator);

      // 可下放标记同步到分配关系上：permissions 才是鉴权 / 后续下放时真正读的那一份
      await tx
        .update(permissions)
        .set({ is_transmit: false, updated_by: operator.user_id })
        .where(eq(permissions.roles_id, current.roles_id));
      if (transmit.length > 0) {
        await tx
          .update(permissions)
          .set({ is_transmit: true, updated_by: operator.user_id })
          .where(and(eq(permissions.roles_id, current.roles_id), inArray(permissions.menus_id, transmit)));
      }
    });

    return this.detail(current.roles_id);
  }

  /**
   * 角色新增的菜单补给持有者。
   * 已经有这条菜单的账号跳过（permissions 的主键是 user_id + menus_id，同一菜单只能来自一个角色），
   * 补进来的授权按角色模板上的 is_transmit 带过去，否则二级管理员会莫名其妙失去下放范围。
   */
  private async grantAddedMenus(
    tx: Parameters<Parameters<FastifyInstance["db"]["transaction"]>[0]>[0],
    roles_id: number,
    menus_id: number[],
    transmit: Set<number>,
    operator: AdminUser,
  ) {
    if (menus_id.length === 0) return;

    const holders = await tx.select({ user_id: permissions.user_id }).from(permissions).where(eq(permissions.roles_id, roles_id));
    const userIds = [...new Set(holders.map((row) => row.user_id))];
    if (userIds.length === 0) return;

    const owned = await tx
      .select({ user_id: permissions.user_id, menus_id: permissions.menus_id })
      .from(permissions)
      .where(inArray(permissions.user_id, userIds));
    const ownedKeys = new Set(owned.map((row) => `${row.user_id}:${row.menus_id}`));

    const missing = userIds.flatMap((user_id) =>
      menus_id
        .filter((menus) => !ownedKeys.has(`${user_id}:${menus}`))
        .map((menus) => ({
          user_id,
          menus_id: menus,
          roles_id,
          is_transmit: transmit.has(menus),
          is_disabled: false,
          created_by: operator.user_id,
          updated_by: operator.user_id,
        })),
    );

    if (missing.length > 0) await tx.insert(permissions).values(missing);
  }

  /** 删除角色：先清分配关系与菜单集合，再删本体（顺序不能反，外键会拦） */
  async remove(roles_id: number, operator: AdminUser): Promise<{ roles_id: number }> {
    await this.findOrFail(roles_id, operator);

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.roles_id, roles_id));
      await tx.delete(roleMenus).where(eq(roleMenus.roles_id, roles_id));
      await tx.delete(roles).where(eq(roles.roles_id, roles_id));
    });

    return { roles_id };
  }

  /**
   * 角色表单的菜单候选范围（按当前登录人算）。
   * 具体规则收在 core/menu-scope.ts，和用户授权弹窗共用同一份实现。
   */
  async scope(operator: AdminUser): Promise<RoleMenuScope> {
    return resolveMenuScope(this.fastify, operator);
  }

  /** 单个角色：列表与「修改后回读」共用同一份投影，保证返回形状一致 */
  private async detail(roles_id: number): Promise<RoleItem> {
    const [row] = await this.fastify.db.select(roleColumns).from(roles).leftJoin(adminUser, eq(roles.created_by, adminUser.user_id)).where(eq(roles.roles_id, roles_id)).limit(1);
    if (!row) throw new AppError(BusinessCode.NOT_FOUND, "角色不存在，请刷新后重试");

    const [menuSet, assigned] = await Promise.all([this.menuSetOf(roles_id), this.fastify.db.select({ user_id: permissions.user_id }).from(permissions).where(eq(permissions.roles_id, roles_id))]);

    return {
      ...row,
      menus_id: menuSet.menus,
      transmit_menus_id: menuSet.transmit,
      user_count: new Set(assigned.map((item) => item.user_id)).size,
    };
  }

  /** 统一校验 + 归一化：名称唯一、菜单存在且可用、下放标记合法，产出可直接落库的字段 */
  private async normalize(body: CreateRoleBody, current: RoleContext | null, operator: AdminUser) {
    const name = body.roles_name.trim();
    if (!name) throw new AppError(BusinessCode.PARAM_ERROR, "角色名称不能为空");

    // 名称只在归属人范围内唯一：不同管理员各建一个「运营」互不影响
    const ownerId = current?.created_by ?? operator.user_id;
    const [duplicated] = await this.fastify.db
      .select({ roles_id: roles.roles_id })
      .from(roles)
      .where(and(eq(roles.created_by, ownerId), eq(roles.roles_name, name), current ? ne(roles.roles_id, current.roles_id) : undefined))
      .limit(1);
    if (duplicated) throw new AppError(BusinessCode.CONFLICT, `角色名称「${name}」已存在，请换一个`);

    const menus_id = await this.resolveMenus(body.menus_id ?? [], current?.menus_id ?? [], operator);
    const transmit = await this.resolveTransmit(body.transmit_menus_id ?? [], menus_id, operator);
    const transmitSet = new Set(transmit);

    return {
      roles_name: name,
      roles_description: body.roles_description?.trim() || null,
      is_disabled: body.is_disabled ?? false,
      menus: menus_id.map((id): RoleMenuValue => ({ menus_id: id, is_transmit: transmitSet.has(id) })),
    };
  }

  /**
   * 菜单校验：去重 + 必须存在 + 禁用菜单不能新分配 + 不能超出自己可下放的范围。
   * 已经在这个角色里的菜单允许原样保留，否则角色一旦勾了被禁用的菜单就再也改不了别的字段。
   */
  private async resolveMenus(menus_id: number[], current: number[], operator: AdminUser) {
    const ids = [...new Set(menus_id)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
    if (ids.length === 0) return ids;

    const rows = await this.fastify.db.select({ menus_id: adminMenus.menus_id, meta: adminMenus.meta, is_disabled: adminMenus.is_disabled }).from(adminMenus).where(inArray(adminMenus.menus_id, ids));

    const found = new Set(rows.map((row) => row.menus_id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) throw new AppError(BusinessCode.PARAM_ERROR, `菜单 ${missing.join("、")} 不存在，请刷新后重试`);

    const keep = new Set(current);
    const blocked = rows.filter((row) => row.is_disabled && !keep.has(row.menus_id));
    if (blocked.length > 0) {
      throw new AppError(BusinessCode.PARAM_ERROR, `菜单「${blocked.map((row) => menuTitleOf(row.meta)).join("」「")}」已禁用，不能分配给角色`);
    }

    // 二级管理员只能分配自己手上「可下放」的菜单：is_transmit = false 的权限只能他自己用
    if (operator.parent_id !== 0) {
      const grantable = new Set(await transmittableMenuIds(this.fastify, operator.user_id));
      const denied = rows.filter((row) => !grantable.has(row.menus_id) && !keep.has(row.menus_id));
      if (denied.length > 0) {
        throw new AppError(BusinessCode.FORBIDDEN, `菜单「${denied.map((row) => menuTitleOf(row.meta)).join("」「")}」没有下放权限，不能分配给下级`);
      }
    }

    return ids;
  }

  /**
   * 可下放标记：必须是这个角色里的菜单。
   * 非超管还要额外收一道 —— 只能标记自己手上 is_transmit = true 的菜单。
   * resolveMenus 对「本来就在角色里」的菜单会放行（免得角色一旦勾了被禁用的菜单就再也改不了），
   * 所以这里不能只依赖 menus_id 的校验，否则历史授权可以被越权标成可下放。
   */
  private async resolveTransmit(transmit_menus_id: number[], menus_id: number[], operator: AdminUser) {
    const allowed = new Set(menus_id);
    const picked = [...new Set(transmit_menus_id)].filter((id) => allowed.has(id)).sort((a, b) => a - b);
    if (operator.parent_id === 0) return picked;

    const grantable = new Set(await transmittableMenuIds(this.fastify, operator.user_id));
    return picked.filter((id) => grantable.has(id));
  }

  private async menuIdsOf(roles_id: number) {
    const rows = await this.fastify.db.select({ menus_id: roleMenus.menus_id }).from(roleMenus).where(eq(roleMenus.roles_id, roles_id)).orderBy(asc(roleMenus.menus_id));
    return rows.map((row) => row.menus_id);
  }

  private async menuSetOf(roles_id: number): Promise<RoleMenuSet> {
    const rows = await this.fastify.db
      .select({ menus_id: roleMenus.menus_id, is_transmit: roleMenus.is_transmit })
      .from(roleMenus)
      .where(eq(roleMenus.roles_id, roles_id))
      .orderBy(asc(roleMenus.menus_id));

    return {
      menus: rows.map((row) => row.menus_id),
      transmit: rows.filter((row) => row.is_transmit).map((row) => row.menus_id),
    };
  }

  /**
   * 取角色并校验管理权：角色归谁建就归谁管，非超管动不了别人（含超管）建的角色。
   * 列表已经不展示别人的角色，这里再拦一道，防止直接拿 ID 调接口改 / 删。
   */
  private async findOrFail(roles_id: number, operator: AdminUser): Promise<RoleContext> {
    const [row] = await this.fastify.db.select({ roles_id: roles.roles_id, created_by: roles.created_by }).from(roles).where(eq(roles.roles_id, roles_id)).limit(1);
    if (!row) throw new AppError(BusinessCode.NOT_FOUND, "角色不存在，请刷新后重试");
    if (operator.parent_id !== 0 && row.created_by !== operator.user_id) throw new AppError(BusinessCode.FORBIDDEN, "只能管理自己创建的角色");
    return { ...row, menus_id: [] };
  }
}

/** 角色 → 菜单集合；一次查全量再分组，避免 N+1 */
function groupMenus(rows: { roles_id: number; menus_id: number; is_transmit: boolean }[]) {
  const map = new Map<number, RoleMenuSet>();
  for (const row of rows) {
    const entry = map.get(row.roles_id) ?? { menus: [], transmit: [] };
    entry.menus.push(row.menus_id);
    if (row.is_transmit) entry.transmit.push(row.menus_id);
    map.set(row.roles_id, entry);
  }
  map.forEach((entry) => {
    entry.menus.sort((a, b) => a - b);
    entry.transmit.sort((a, b) => a - b);
  });
  return map;
}

/** 角色 → 已分配用户集合（同一个用户可能有多条 permissions，按 user_id 去重） */
function groupUsers(rows: { roles_id: number; user_id: number }[]) {
  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = map.get(row.roles_id);
    if (set) set.add(row.user_id);
    else map.set(row.roles_id, new Set([row.user_id]));
  }
  return map;
}
