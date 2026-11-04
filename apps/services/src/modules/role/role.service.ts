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

interface RoleContext {
  roles_id: number;
  created_by: number;
  menus_id: number[];
}

interface RoleMenuValue {
  menus_id: number;
  is_transmit: boolean;
}

interface RoleMenuSet {
  menus: number[];
  transmit: number[];
}

export default class RoleService {
  constructor(private readonly fastify: FastifyInstance) {}

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

      await tx
        .delete(permissions)
        .where(menus_id.length > 0 ? and(eq(permissions.roles_id, current.roles_id), notInArray(permissions.menus_id, menus_id)) : eq(permissions.roles_id, current.roles_id));

      await this.grantAddedMenus(tx, current.roles_id, menus_id, new Set(transmit), operator);

      await tx.update(permissions).set({ is_transmit: false, updated_by: operator.user_id }).where(eq(permissions.roles_id, current.roles_id));
      if (transmit.length > 0) {
        await tx
          .update(permissions)
          .set({ is_transmit: true, updated_by: operator.user_id })
          .where(and(eq(permissions.roles_id, current.roles_id), inArray(permissions.menus_id, transmit)));
      }
    });

    return this.detail(current.roles_id);
  }

  private async grantAddedMenus(tx: Parameters<Parameters<FastifyInstance["db"]["transaction"]>[0]>[0], roles_id: number, menus_id: number[], transmit: Set<number>, operator: AdminUser) {
    if (menus_id.length === 0) return;

    const holders = await tx.select({ user_id: permissions.user_id }).from(permissions).where(eq(permissions.roles_id, roles_id));
    const userIds = [...new Set(holders.map((row) => row.user_id))];
    if (userIds.length === 0) return;

    const owned = await tx.select({ user_id: permissions.user_id, menus_id: permissions.menus_id }).from(permissions).where(inArray(permissions.user_id, userIds));
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

  async remove(roles_id: number, operator: AdminUser): Promise<{ roles_id: number }> {
    await this.findOrFail(roles_id, operator);

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.roles_id, roles_id));
      await tx.delete(roleMenus).where(eq(roleMenus.roles_id, roles_id));
      await tx.delete(roles).where(eq(roles.roles_id, roles_id));
    });

    return { roles_id };
  }

  async scope(operator: AdminUser): Promise<RoleMenuScope> {
    return resolveMenuScope(this.fastify, operator);
  }

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

  private async normalize(body: CreateRoleBody, current: RoleContext | null, operator: AdminUser) {
    const name = body.roles_name.trim();
    if (!name) throw new AppError(BusinessCode.PARAM_ERROR, "角色名称不能为空");

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

    if (operator.parent_id !== 0) {
      const grantable = new Set(await transmittableMenuIds(this.fastify, operator.user_id));
      const denied = rows.filter((row) => !grantable.has(row.menus_id) && !keep.has(row.menus_id));
      if (denied.length > 0) {
        throw new AppError(BusinessCode.FORBIDDEN, `菜单「${denied.map((row) => menuTitleOf(row.meta)).join("」「")}」没有下放权限，不能分配给下级`);
      }
    }

    return ids;
  }

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

  private async findOrFail(roles_id: number, operator: AdminUser): Promise<RoleContext> {
    const [row] = await this.fastify.db.select({ roles_id: roles.roles_id, created_by: roles.created_by }).from(roles).where(eq(roles.roles_id, roles_id)).limit(1);
    if (!row) throw new AppError(BusinessCode.NOT_FOUND, "角色不存在，请刷新后重试");
    if (operator.parent_id !== 0 && row.created_by !== operator.user_id) throw new AppError(BusinessCode.FORBIDDEN, "只能管理自己创建的角色");
    return { ...row, menus_id: [] };
  }
}

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

function groupUsers(rows: { roles_id: number; user_id: number }[]) {
  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    const set = map.get(row.roles_id);
    if (set) set.add(row.user_id);
    else map.set(row.roles_id, new Set([row.user_id]));
  }
  return map;
}
