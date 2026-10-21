import { adminMenus } from "@/db/admin-menus";
import { asc, eq, and, inArray, isNull } from "drizzle-orm";
import type { MenuBody, MenuUpdateBody } from "./menu.schema";
import { code } from "@/db/code";
import { permissions } from "@/db/permissions";
import { AppError, BusinessCode } from "@/core/app-error";
import type { CachedAuthUser } from "@/types/auth";

type MenuItem = typeof adminMenus.$inferSelect;
type MenuTreeItem = MenuItem & { children: MenuTreeItem[] };
type MenuRelation = Pick<MenuItem, "admin_menus_id" | "parent_id">;
type MenuRouteIdentity = Pick<MenuItem, "admin_menus_id" | "type" | "meta">;

function metaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "string" ? value.trim() : "";
}

function validateMenuShape(menu: MenuBody, parentType: MenuItem["type"] | null) {
  const title = metaString(menu.meta, "title");
  if (!title) throw new AppError(BusinessCode.PARAM_ERROR, "菜单名称不能为空");

  if (menu.type === "button") {
    if (parentType !== "page") throw new AppError(BusinessCode.PARAM_ERROR, "按钮的父级必须是页面");
    if (!menu.permission) throw new AppError(BusinessCode.PARAM_ERROR, "按钮必须绑定权限码");
    return;
  }

  if (parentType !== null && parentType !== "directory") {
    throw new AppError(BusinessCode.PARAM_ERROR, `${menu.type === "directory" ? "目录" : "页面"}的父级只能是目录`);
  }
  if (menu.type === "directory" && menu.permission) {
    throw new AppError(BusinessCode.PARAM_ERROR, "目录不能绑定权限码");
  }

  const path = metaString(menu.meta, "path");
  const name = metaString(menu.meta, "name");
  if (!path || !path.startsWith("/")) throw new AppError(BusinessCode.PARAM_ERROR, "路由路径必须以 / 开头");
  if (!name) throw new AppError(BusinessCode.PARAM_ERROR, "路由名称不能为空");
}

function validateRouteUniqueness(newMenus: MenuBody[], existingMenus: MenuRouteIdentity[]) {
  const paths = new Set<string>();
  const names = new Set<string>();

  for (const item of existingMenus) {
    if (item.type === "button") continue;
    const path = metaString(item.meta, "path");
    const name = metaString(item.meta, "name");
    if (path) paths.add(path);
    if (name) names.add(name);
  }

  for (const item of newMenus) {
    if (item.type === "button") continue;
    const path = metaString(item.meta, "path");
    const name = metaString(item.meta, "name");
    if (paths.has(path)) throw new AppError(BusinessCode.CONFLICT, `路由路径 ${path} 已存在`);
    if (names.has(name)) throw new AppError(BusinessCode.CONFLICT, `路由名称 ${name} 已存在`);
    paths.add(path);
    names.add(name);
  }
}

function buildMenuTree(list: MenuItem[], parent_id = 0): MenuTreeItem[] {
  if (list.length === 0) return [];
  const arr: MenuTreeItem[] = [];
  for (let i = 0; i < list.length;) {
    if (list[i].parent_id === parent_id) {
      const [row] = list.splice(i, 1);
      const item: MenuTreeItem = {
        ...row,
        children: buildMenuTree(list, row.admin_menus_id),
      };
      arr.push(item);
    } else {
      i++;
    }
  }
  arr.sort((a, b) => a.sort - b.sort);
  return arr;
}

function filterMenuTree(list: MenuTreeItem[], search: string): MenuTreeItem[] {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return list;

  return list.reduce<MenuTreeItem[]>((result, item) => {
    const children = filterMenuTree(item.children, keyword);
    const meta = item.meta ?? {};
    const matched = [meta.title, meta.path, meta.name, item.permission].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(keyword),
    );
    if (matched || children.length > 0) result.push({ ...item, children });
    return result;
  }, []);
}

function collectMenuIds(menuRows: MenuRelation[], rootMenuId: number): number[] {
  const childrenMap = new Map<number, number[]>();
  for (const item of menuRows) {
    const children = childrenMap.get(item.parent_id) ?? [];
    children.push(item.admin_menus_id);
    childrenMap.set(item.parent_id, children);
  }

  const menuIds: number[] = [];
  const visited = new Set<number>();
  const queue = [rootMenuId];
  while (queue.length > 0) {
    const menuId = queue.shift()!;
    if (visited.has(menuId)) continue;
    visited.add(menuId);
    menuIds.push(menuId);
    queue.push(...(childrenMap.get(menuId) ?? []));
  }

  return menuIds;
}

export default class MenuService {
  constructor(private readonly fastify: FastifyInstance) {}

  async add(menuData: MenuBody, children: MenuBody[]) {
    if (menuData.type === "button" && children.length > 0) {
      throw new AppError(BusinessCode.PARAM_ERROR, "按钮类型不能包含子菜单");
    }
    const permissionCodes = [menuData.permission, ...children.map((item) => item.permission)].filter(
      (permission): permission is NonNullable<typeof permission> => permission !== null,
    );
    const duplicatePermission = permissionCodes.find(
      (permission, index) => permissionCodes.indexOf(permission) !== index,
    );
    if (duplicatePermission) {
      throw new AppError(BusinessCode.CONFLICT, `权限 ${duplicatePermission} 在本次新增中被重复绑定`);
    }
    return this.fastify.db.transaction(async (tx) => {
      const existingMenus = await tx
        .select({ admin_menus_id: adminMenus.admin_menus_id, type: adminMenus.type, meta: adminMenus.meta })
        .from(adminMenus);
      let parentType: MenuItem["type"] | null = null;
      if (menuData.parent_id !== 0) {
        const parentMenu = existingMenus.find((item) => item.admin_menus_id === menuData.parent_id);
        if (!parentMenu) throw new AppError(BusinessCode.PARAM_ERROR, `父级菜单 ${menuData.parent_id} 不存在`);
        parentType = parentMenu.type;
      }
      validateMenuShape(menuData, parentType);
      children.forEach((item) => validateMenuShape(item, menuData.type));
      validateRouteUniqueness([menuData, ...children], existingMenus);

      if (permissionCodes.length > 0) {
        const permissionRows = await tx
          .select({ code: code.code, bind_menu_id: code.bind_menu_id, is_disabled: code.is_disabled })
          .from(code)
          .where(inArray(code.code, permissionCodes));
        const permissionMap = new Map(permissionRows.map((item) => [item.code, item]));

        const missingPermission = permissionCodes.find((permission) => !permissionMap.has(permission));
        if (missingPermission) {
          throw new AppError(BusinessCode.PARAM_ERROR, `权限 ${missingPermission} 不存在`);
        }

        const disabledPermission = permissionCodes.find((permission) => permissionMap.get(permission)?.is_disabled);
        if (disabledPermission) {
          throw new AppError(BusinessCode.PARAM_ERROR, `权限 ${disabledPermission} 已禁用`);
        }

        const boundPermission = permissionCodes.find(
          (permission) => permissionMap.get(permission)?.bind_menu_id !== null,
        );
        if (boundPermission) {
          throw new AppError(
            BusinessCode.CONFLICT,
            `权限 ${boundPermission} 已绑定菜单 ${permissionMap.get(boundPermission)?.bind_menu_id}`,
          );
        }
      }
      const [{ admin_menus_id: menuId }] = await tx.insert(adminMenus).values(menuData).$returningId();
      const bindings: Array<{ permission: NonNullable<MenuBody["permission"]>; menuId: number }> = [];
      if (menuData.permission) bindings.push({ permission: menuData.permission, menuId });
      if (children.length > 0) {
        const childValues = children.map((item) => ({ ...item, parent_id: menuId }));
        const insertedRows = await tx.insert(adminMenus).values(childValues).$returningId();
        insertedRows.forEach((row, index) => {
          const permission = childValues[index].permission;
          if (permission) bindings.push({ permission, menuId: row.admin_menus_id });
        });
      }
      for (const binding of bindings) {
        const [result] = await tx
          .update(code)
          .set({ bind_menu_id: binding.menuId })
          .where(and(eq(code.code, binding.permission), isNull(code.bind_menu_id)));
        if (result.affectedRows !== 1) {
          throw new AppError(BusinessCode.CONFLICT, `权限 ${binding.permission} 已被其他菜单绑定`);
        }
      }
      return { admin_menus_id: menuId };
    });
  }
  async update(menuData: MenuUpdateBody) {
    const { admin_menus_id: menuId, ...updateData } = menuData;
    await this.fastify.db.transaction(async (tx) => {
      const menuRows = await tx
        .select({
          admin_menus_id: adminMenus.admin_menus_id,
          parent_id: adminMenus.parent_id,
          type: adminMenus.type,
          permission: adminMenus.permission,
          meta: adminMenus.meta,
        })
        .from(adminMenus);
      const oldMenu = menuRows.find((item) => item.admin_menus_id === menuId);
      if (!oldMenu) {
        throw new AppError(BusinessCode.NOT_FOUND, "菜单不存在");
      }
      if (updateData.parent_id === menuId) {
        throw new AppError(BusinessCode.PARAM_ERROR, "菜单不能将自己设置为父级");
      }
      const descendantIds = new Set(collectMenuIds(menuRows, menuId).slice(1));
      if (descendantIds.has(updateData.parent_id)) {
        throw new AppError(BusinessCode.PARAM_ERROR, "不能将菜单移动到自己的子菜单下");
      }
      if (updateData.parent_id !== 0) {
        const parentMenu = menuRows.find((item) => item.admin_menus_id === updateData.parent_id);
        if (!parentMenu) {
          throw new AppError(BusinessCode.PARAM_ERROR, `父级菜单 ${updateData.parent_id} 不存在`);
        }
        if (parentMenu.type === "button") {
          throw new AppError(BusinessCode.PARAM_ERROR, "按钮类型不能作为父级菜单");
        }
      }
      if (updateData.type === "button" && descendantIds.size > 0) {
        throw new AppError(BusinessCode.PARAM_ERROR, "存在子菜单时不能修改为按钮类型");
      }
      const oldPermission = oldMenu.permission;
      const newPermission = updateData.permission;
      const parentType =
        updateData.parent_id === 0
          ? null
          : (menuRows.find((item) => item.admin_menus_id === updateData.parent_id)?.type ?? null);
      validateMenuShape(updateData, parentType);
      validateRouteUniqueness(
        [updateData],
        menuRows.filter((item) => item.admin_menus_id !== menuId),
      );
      if (oldPermission !== newPermission) {
        if (newPermission) {
          const [permissionRow] = await tx
            .select({ bind_menu_id: code.bind_menu_id, is_disabled: code.is_disabled })
            .from(code)
            .where(eq(code.code, newPermission))
            .limit(1);
          if (!permissionRow) {
            throw new AppError(BusinessCode.PARAM_ERROR, `权限 ${newPermission} 不存在`);
          }
          if (permissionRow.is_disabled) {
            throw new AppError(BusinessCode.PARAM_ERROR, `权限 ${newPermission} 已禁用`);
          }
          if (permissionRow.bind_menu_id !== null && permissionRow.bind_menu_id !== menuId) {
            throw new AppError(BusinessCode.CONFLICT, `权限 ${newPermission} 已绑定菜单 ${permissionRow.bind_menu_id}`);
          }
          if (permissionRow.bind_menu_id === null) {
            const [result] = await tx
              .update(code)
              .set({ bind_menu_id: menuId })
              .where(and(eq(code.code, newPermission), isNull(code.bind_menu_id)));

            if (result.affectedRows !== 1) {
              throw new AppError(BusinessCode.CONFLICT, `权限 ${newPermission} 已被其他菜单绑定`);
            }
          }
        }
        if (oldPermission) {
          await tx
            .update(code)
            .set({ bind_menu_id: null })
            .where(and(eq(code.code, oldPermission), eq(code.bind_menu_id, menuId)));
        }
      }
      await tx.update(adminMenus).set(updateData).where(eq(adminMenus.admin_menus_id, menuId));
    });
  }
  async list(search: string) {
    const rows = await this.fastify.db
      .select()
      .from(adminMenus)
      .orderBy(asc(adminMenus.parent_id), asc(adminMenus.sort), asc(adminMenus.admin_menus_id));
    return { list: filterMenuTree(buildMenuTree(rows), search) };
  }

  async getCurrentUserMenus(uid: string) {
    const cached = await this.fastify.redis.get(uid);
    if (!cached) throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态已失效，请重新登录");

    let user: CachedAuthUser;
    try {
      user = JSON.parse(cached) as CachedAuthUser;
    } catch {
      throw new AppError(BusinessCode.UNAUTHORIZED, "登录信息无效，请重新登录");
    }

    const rows = (
      await this.fastify.db
        .select()
        .from(adminMenus)
        .orderBy(asc(adminMenus.parent_id), asc(adminMenus.sort), asc(adminMenus.admin_menus_id))
    ).filter((item) => !item.is_disabled);
    if (user.parent_id === 0) return { list: buildMenuTree(rows) };

    const userId = Number(user.user_id);
    if (!Number.isInteger(userId) || userId <= 0)
      throw new AppError(BusinessCode.UNAUTHORIZED, "登录信息无效，请重新登录");

    const grants = await this.fastify.db
      .select({ admin_menus_id: permissions.admin_menus_id })
      .from(permissions)
      .where(and(eq(permissions.user_id, userId), eq(permissions.is_disabled, false)));
    const menuMap = new Map(rows.map((item) => [item.admin_menus_id, item]));
    const accessibleIds = new Set<number>();

    for (const grant of grants) {
      let current = menuMap.get(grant.admin_menus_id);
      while (current && !accessibleIds.has(current.admin_menus_id)) {
        accessibleIds.add(current.admin_menus_id);
        current = current.parent_id === 0 ? undefined : menuMap.get(current.parent_id);
      }
    }

    return { list: buildMenuTree(rows.filter((item) => accessibleIds.has(item.admin_menus_id))) };
  }
  async delete(menuId: number) {
    await this.fastify.db.transaction(async (tx) => {
      const menuRows = await tx
        .select({ admin_menus_id: adminMenus.admin_menus_id, parent_id: adminMenus.parent_id })
        .from(adminMenus);
      if (!menuRows.some((item) => item.admin_menus_id === menuId)) {
        throw new AppError(BusinessCode.NOT_FOUND, "菜单不存在");
      }
      const menuIds = collectMenuIds(menuRows, menuId);
      await tx.update(code).set({ bind_menu_id: null }).where(inArray(code.bind_menu_id, menuIds));
      await tx.delete(permissions).where(inArray(permissions.admin_menus_id, menuIds));
      await tx.delete(adminMenus).where(inArray(adminMenus.admin_menus_id, menuIds));
    });
  }
}
