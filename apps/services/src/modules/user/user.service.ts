import { and, asc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import type {
  CreateUserBody,
  RoleOption,
  UpdateUserBody,
  UserItem,
  UserListQuery,
  UserListResult,
  UserMenuGrant,
  UserPermissionBody,
  UserPermissionDetail,
  UserRole,
} from "@repo/shared";
import { AppError } from "@/core/app_error";
import { menuTitleOf, resolveMenuScope, transmittableMenuIds } from "@/core/menu-scope";
import { adminMenus } from "@/db/admin_menus";
import { adminUser, type AdminUser } from "@/db/admin_user";
import { permissions } from "@/db/permissions";
import { roleMenus } from "@/db/role_menus";
import { roles } from "@/db/roles";
import { hashPassword } from "@/utils/password";
import { sessionSetKey } from "@/utils/session";

/** 用户表的对外投影：密码永不下发 */
const userColumns = {
  user_id: adminUser.user_id,
  parent_id: adminUser.parent_id,
  account: adminUser.account,
  nickname: adminUser.nickname,
  status: adminUser.status,
  remark: adminUser.remark,
  created_at: adminUser.created_at,
  updated_at: adminUser.updated_at,
};

/**
 * 用户服务：管理员账号的增删改查 + 权限分配。
 *
 * 四条硬规则：
 *   1. 只管下级：超管能管任意账号（不含自己），其他管理员只管直属下级，同级 / 上级一律拒绝；
 *   2. 账号全局唯一，软删除（status = deleted）后账号仍占用，避免历史权限记录串号；
 *   3. 禁用 / 删除立刻踢掉该账号的所有会话（Redis 里按账号存了一份 uid 集合）；
 *   4. 权限分配按全量覆盖写 permissions：菜单必须落在所选角色的菜单并集里，
 *      非超管还必须落在自己 is_transmit = true 的范围内；is_transmit 只能标在自己可下放的菜单上，
 *      所以「还能不能再往下传」始终由上一级决定 —— 下放可以多级，但每级都要上级先给。
 */
export default class UserService {
  constructor(private readonly fastify: FastifyInstance) {}

  /** 账号列表：超管看全部（不含自己），其他管理员只看直属下级；一次拉全量，附上角色与菜单数 */
  async list(query: UserListQuery, operator: AdminUser): Promise<UserListResult> {
    // 自己那一行不列出来：对自己的账号点编辑 / 分配权限没有意义，也不该允许
    const filters: SQL[] = [ne(adminUser.status, "deleted"), ne(adminUser.user_id, operator.user_id)];
    if (operator.parent_id !== 0) filters.push(eq(adminUser.parent_id, operator.user_id));

    const keyword = query.keyword?.trim();
    if (keyword) {
      const like = `%${keyword}%`;
      const matched = or(ilike(adminUser.account, like), ilike(adminUser.nickname, like));
      if (matched) filters.push(matched);
    }
    if (query.status) filters.push(eq(adminUser.status, query.status));

    const rows = await this.fastify.db
      .select(userColumns)
      .from(adminUser)
      .where(and(...filters))
      .orderBy(asc(adminUser.user_id));

    const userIds = rows.map((row) => row.user_id);
    const grants = userIds.length > 0 ? await this.fastify.db.select({ user_id: permissions.user_id, roles_id: permissions.roles_id }).from(permissions).where(inArray(permissions.user_id, userIds)) : [];
    const roleRows = await this.fastify.db.select({ roles_id: roles.roles_id, roles_name: roles.roles_name }).from(roles);
    const roleName = new Map(roleRows.map((row) => [row.roles_id, row.roles_name]));

    const rolesByUser = new Map<number, UserRole[]>();
    const menuCount = new Map<number, number>();
    for (const grant of grants) {
      menuCount.set(grant.user_id, (menuCount.get(grant.user_id) ?? 0) + 1);
      const list = rolesByUser.get(grant.user_id) ?? [];
      if (!list.some((item) => item.roles_id === grant.roles_id)) {
        list.push({ roles_id: grant.roles_id, roles_name: roleName.get(grant.roles_id) ?? `角色 ${grant.roles_id}` });
      }
      rolesByUser.set(grant.user_id, list);
    }

    return {
      list: rows.map((row) => ({
        ...row,
        roles: rolesByUser.get(row.user_id) ?? [],
        menus_count: menuCount.get(row.user_id) ?? 0,
      })),
      total: rows.length,
    };
  }

  /** 新增直属下级：账号唯一、密码哈希后落库，初始状态 normal */
  async create(body: CreateUserBody, operator: AdminUser): Promise<UserItem> {
    const account = body.account.trim();

    const [existing] = await this.fastify.db.select({ user_id: adminUser.user_id }).from(adminUser).where(eq(adminUser.account, account)).limit(1);
    if (existing) throw new AppError(BusinessCode.CONFLICT, `账号「${account}」已被占用，请换一个`);

    const [row] = await this.fastify.db
      .insert(adminUser)
      .values({
        parent_id: operator.user_id,
        account,
        nickname: body.nickname.trim(),
        password: await hashPassword(body.password),
        status: "normal",
        created_by: operator.user_id,
        remark: body.remark?.trim() || null,
      })
      .returning({ user_id: adminUser.user_id });

    return this.detail(row.user_id);
  }

  /** 编辑直属下级：账号不可改；密码留空表示不动 */
  async update(body: UpdateUserBody, operator: AdminUser): Promise<UserItem> {
    const target = await this.findTarget(body.user_id, operator);

    const values: Partial<typeof adminUser.$inferInsert> = {
      nickname: body.nickname.trim(),
      status: body.status,
      remark: body.remark?.trim() || null,
    };
    if (body.password) values.password = await hashPassword(body.password);

    await this.fastify.db.update(adminUser).set(values).where(eq(adminUser.user_id, target.user_id));

    // 禁用后令牌要立刻失效，否则旧会话还能继续用
    if (body.status === "disabled") await this.kickSessions(target.user_id);

    return this.detail(target.user_id);
  }

  /** 删除直属下级：软删除 + 清授权 + 踢会话；有下级时拒绝，避免留下孤儿账号 */
  async remove(user_id: number, operator: AdminUser): Promise<{ user_id: number }> {
    const target = await this.findTarget(user_id, operator);

    const [child] = await this.fastify.db
      .select({ user_id: adminUser.user_id })
      .from(adminUser)
      .where(and(eq(adminUser.parent_id, target.user_id), ne(adminUser.status, "deleted")))
      .limit(1);
    if (child) throw new AppError(BusinessCode.CONFLICT, "该账号下还有下级用户，请先处理下级再删除");

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.user_id, target.user_id));
      await tx.update(adminUser).set({ status: "deleted", deleted_at: sql`now()` }).where(eq(adminUser.user_id, target.user_id));
    });

    await this.kickSessions(target.user_id);

    return { user_id: target.user_id };
  }

  /** 权限详情：已分配的授权 + 可分配的角色 + 可分配的菜单范围 */
  async permissionDetail(user_id: number, operator: AdminUser): Promise<UserPermissionDetail> {
    await this.findTarget(user_id, operator);

    const [permRows, roleOptions, scope] = await Promise.all([
      this.fastify.db.select({ menus_id: permissions.menus_id, roles_id: permissions.roles_id, is_transmit: permissions.is_transmit }).from(permissions).where(eq(permissions.user_id, user_id)),
      this.assignableRoles(operator),
      resolveMenuScope(this.fastify, operator),
    ]);

    const menus: UserMenuGrant[] = permRows
      .map((row) => ({ menus_id: row.menus_id, roles_id: row.roles_id, is_transmit: row.is_transmit }))
      .sort((a, b) => a.menus_id - b.menus_id);

    return {
      user_id,
      roles_id: [...new Set(permRows.map((row) => row.roles_id))].sort((a, b) => a - b),
      menus,
      roles: roleOptions,
      scope,
    };
  }

  /**
   * 保存权限（全量覆盖）。
   * 每条授权的来源角色取「roles_id 里第一个包含该菜单的角色」，和 permissions 的 PK（user_id + menus_id）对齐。
   */
  async savePermission(body: UserPermissionBody, operator: AdminUser): Promise<UserPermissionDetail> {
    await this.findTarget(body.user_id, operator);

    const assignable = new Map((await this.assignableRoles(operator)).map((role) => [role.roles_id, role]));
    const roleIds = [...new Set(body.roles_id)];
    const deniedRole = roleIds.filter((id) => !assignable.has(id));
    if (deniedRole.length > 0) throw new AppError(BusinessCode.FORBIDDEN, `角色 ${deniedRole.join("、")} 不能分配给别人，请刷新后重试`);

    // 菜单 → 来源角色：按角色顺序先到先得
    const owner = new Map<number, number>();
    for (const roles_id of roleIds) {
      for (const menus_id of assignable.get(roles_id)!.menus_id) {
        if (!owner.has(menus_id)) owner.set(menus_id, roles_id);
      }
    }

    const menus_id = [...new Set(body.menus_id)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
    const outside = menus_id.filter((id) => !owner.has(id));
    if (outside.length > 0) {
      const titles = await this.menuTitles(outside);
      throw new AppError(BusinessCode.PARAM_ERROR, `菜单「${titles.join("」「")}」不在所选角色的范围里，请先勾上对应角色`);
    }

    // 非超管只能分配自己手上「可下放」的菜单
    const grantable = operator.parent_id === 0 ? null : new Set(await transmittableMenuIds(this.fastify, operator.user_id));
    if (grantable) {
      const denied = menus_id.filter((id) => !grantable.has(id));
      if (denied.length > 0) {
        const titles = await this.menuTitles(denied);
        throw new AppError(BusinessCode.FORBIDDEN, `菜单「${titles.join("」「")}」没有下放权限，不能分配给下级`);
      }
    }

    // 可下放标记：只能打在本次真正分配出去的菜单上；非超管还要落在自己「可下放」的范围内。
    // 「还能不能再往下传」由此始终由上一级决定 —— 上级没给你可下放，你就传不下去。
    const grantedMenus = new Set(menus_id);
    const transmit = new Set(
      body.transmit_menus_id.filter((id) => grantedMenus.has(id) && (grantable === null || grantable.has(id))),
    );

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.user_id, body.user_id));
      if (menus_id.length === 0) return;

      await tx.insert(permissions).values(
        menus_id.map((menus_id) => ({
          user_id: body.user_id,
          menus_id,
          roles_id: owner.get(menus_id)!,
          is_transmit: transmit.has(menus_id),
          is_disabled: false,
          created_by: operator.user_id,
          updated_by: operator.user_id,
        })),
      );
    });

    return this.permissionDetail(body.user_id, operator);
  }

  /** 单个用户的对外投影 */
  private async detail(user_id: number): Promise<UserItem> {
    const [row] = await this.fastify.db.select(userColumns).from(adminUser).where(eq(adminUser.user_id, user_id)).limit(1);
    if (!row) throw new AppError(BusinessCode.NOT_FOUND, "用户不存在，请刷新后重试");

    const grants = await this.fastify.db.select({ roles_id: permissions.roles_id }).from(permissions).where(eq(permissions.user_id, user_id));
    const roles_id = [...new Set(grants.map((item) => item.roles_id))];
    const roleRows = roles_id.length > 0 ? await this.fastify.db.select({ roles_id: roles.roles_id, roles_name: roles.roles_name }).from(roles).where(inArray(roles.roles_id, roles_id)) : [];

    return { ...row, roles: roleRows, menus_count: grants.length };
  }

  /**
   * 能分配给下级的角色：
   * 超管看全部启用中的角色；其他管理员只看自己建的（角色归属人 = 自己）。
   * 这样二级管理员不会拿到一个菜单范围超出他自己权限的角色。
   */
  private async assignableRoles(operator: AdminUser): Promise<RoleOption[]> {
    const rows = await this.fastify.db
      .select({ roles_id: roles.roles_id, roles_name: roles.roles_name })
      .from(roles)
      .where(operator.parent_id === 0 ? eq(roles.is_disabled, false) : and(eq(roles.is_disabled, false), eq(roles.created_by, operator.user_id)))
      .orderBy(asc(roles.roles_id));

    const menuRows = await this.fastify.db.select({ roles_id: roleMenus.roles_id, menus_id: roleMenus.menus_id }).from(roleMenus);
    const menusByRole = new Map<number, number[]>();
    for (const row of menuRows) {
      const list = menusByRole.get(row.roles_id) ?? [];
      list.push(row.menus_id);
      menusByRole.set(row.roles_id, list);
    }

    return rows.map((row) => ({ ...row, menus_id: (menusByRole.get(row.roles_id) ?? []).sort((a, b) => a - b) }));
  }

  /**
   * 取目标用户并校验管理权。
   * 超管能管任意账号（含别人建的下级），但一律排除自己 —— 改自己的状态 / 权限会把自己锁在门外；
   * 其他管理员只管直属下级，同级和上级都碰不到。
   */
  private async findTarget(user_id: number, operator: AdminUser) {
    const [row] = await this.fastify.db.select().from(adminUser).where(eq(adminUser.user_id, user_id)).limit(1);
    if (!row || row.status === "deleted") throw new AppError(BusinessCode.NOT_FOUND, "用户不存在，请刷新后重试");
    if (row.user_id === operator.user_id) throw new AppError(BusinessCode.FORBIDDEN, "不能操作自己的账号");
    if (operator.parent_id !== 0 && row.parent_id !== operator.user_id) throw new AppError(BusinessCode.FORBIDDEN, "只能管理自己的直属下级");
    return row;
  }

  /** 禁用 / 删除时清掉该账号的所有会话：Redis 里按账号存了一份 uid 集合 */
  private async kickSessions(user_id: number) {
    const key = sessionSetKey(user_id);
    const uids = await this.fastify.redis.smembers(key);
    if (uids.length === 0) return;

    await this.fastify.redis.multi().del(...uids).del(key).exec();
  }

  private async menuTitles(menus_id: number[]) {
    const rows = await this.fastify.db.select({ menus_id: adminMenus.menus_id, meta: adminMenus.meta }).from(adminMenus).where(inArray(adminMenus.menus_id, menus_id));
    const titles = new Map(rows.map((row) => [row.menus_id, menuTitleOf(row.meta)]));
    return menus_id.map((id) => titles.get(id) ?? `菜单 ${id}`);
  }
}
