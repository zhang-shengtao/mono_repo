import { randomUUID } from "node:crypto";
import { AppError, BusinessCode } from "@/core/app-error";
import { adminMenus } from "@/db/admin-menus";
import { adminUser } from "@/db/admin-user";
import { permissions } from "@/db/permissions";
import type { CachedAuthUser, DecodedJwtPayload } from "@/types/auth";
import { formatLogTime } from "@/utils";
import { paginate } from "@/utils/pagination";
import { hashPassword, verifyPassword } from "@/utils/password";
import { and, asc, count, eq, inArray, like, ne, or } from "drizzle-orm";
import type { UserAddBody, UserListQuery, UserPermissionBody, UserUpdateBody } from "./user.schema";

const SESSION_SET_PREFIX = "admin:user:sessions:";

export default class UserService {
  constructor(private readonly fastify: FastifyInstance) {}

  async list(query: UserListQuery, uid: string) {
    const manager = await this.getCachedUser(uid);
    const conditions = [eq(adminUser.parent_id, manager.user_id), ne(adminUser.status, "deleted")];
    if (query.status !== "all") conditions.push(eq(adminUser.status, query.status));
    if (query.search) {
      const keyword = `%${query.search}%`;
      conditions.push(
        or(like(adminUser.account, keyword), like(adminUser.nickname, keyword), like(adminUser.remark, keyword))!,
      );
    }
    const where = and(...conditions);

    return paginate(query, {
      list: ({ limit, offset }) =>
        this.fastify.db
          .select({
            user_id: adminUser.user_id,
            parent_id: adminUser.parent_id,
            account: adminUser.account,
            nickname: adminUser.nickname,
            status: adminUser.status,
            created_by: adminUser.created_by,
            remark: adminUser.remark,
            created_at: adminUser.created_at,
            updated_at: adminUser.updated_at,
            deleted_at: adminUser.deleted_at,
          })
          .from(adminUser)
          .where(where)
          .orderBy(asc(adminUser.user_id))
          .limit(limit)
          .offset(offset),
      total: () => this.fastify.db.select({ total: count() }).from(adminUser).where(where),
    });
  }

  async add(data: UserAddBody, uid: string) {
    const manager = await this.getCachedUser(uid);
    const [existing] = await this.fastify.db
      .select({ user_id: adminUser.user_id })
      .from(adminUser)
      .where(eq(adminUser.account, data.account))
      .limit(1);
    if (existing) throw new AppError(BusinessCode.CONFLICT, `账号 ${data.account} 已存在`);

    const password = await hashPassword(data.password);
    const [{ user_id }] = await this.fastify.db
      .insert(adminUser)
      .values({
        parent_id: manager.user_id,
        account: data.account,
        nickname: data.nickname,
        password,
        created_by: manager.user_id,
        remark: data.remark,
      })
      .$returningId();
    return { user_id };
  }

  async update(data: UserUpdateBody, uid: string) {
    const manager = await this.getCachedUser(uid);
    await this.ensureManagedUser(manager.user_id, data.user_id);

    const updateData: Partial<typeof adminUser.$inferInsert> = {
      nickname: data.nickname,
      status: data.status,
      remark: data.remark,
      updated_at: formatLogTime(),
    };
    if (data.password) updateData.password = await hashPassword(data.password);
    await this.fastify.db.update(adminUser).set(updateData).where(eq(adminUser.user_id, data.user_id));

    if (data.status === "disabled" || data.password) await this.revokeUserSessions(data.user_id);
  }

  async delete(userId: number, uid: string) {
    const manager = await this.getCachedUser(uid);
    await this.ensureManagedUser(manager.user_id, userId);

    await this.fastify.db.transaction(async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(adminUser)
        .where(and(eq(adminUser.parent_id, userId), ne(adminUser.status, "deleted")));
      if (total > 0) throw new AppError(BusinessCode.CONFLICT, "该账号仍有直属子账号，请先处理下级账号");

      const now = formatLogTime();
      await tx
        .update(adminUser)
        .set({ status: "deleted", deleted_at: now, updated_at: now })
        .where(eq(adminUser.user_id, userId));
      await tx.delete(permissions).where(eq(permissions.user_id, userId));
    });
    await this.revokeUserSessions(userId);
  }

  async getPermissions(userId: number, uid: string) {
    const manager = await this.getCachedUser(uid);
    await this.ensureManagedUser(manager.user_id, userId);
    const availableMenus = await this.getGrantableMenus(manager);
    if (availableMenus.length === 0) return { list: [] };

    const availableIds = availableMenus.map((item) => item.admin_menus_id);
    const grants = await this.fastify.db
      .select({ admin_menus_id: permissions.admin_menus_id, is_transmit: permissions.is_transmit })
      .from(permissions)
      .where(
        and(
          eq(permissions.user_id, userId),
          inArray(permissions.admin_menus_id, availableIds),
          eq(permissions.is_disabled, false),
        ),
      );
    const grantMap = new Map(grants.map((item) => [item.admin_menus_id, item]));

    return {
      list: availableMenus.map((item) => ({
        ...item,
        granted: grantMap.has(item.admin_menus_id),
        is_transmit: grantMap.get(item.admin_menus_id)?.is_transmit ?? false,
      })),
    };
  }

  async setPermissions(data: UserPermissionBody, uid: string) {
    const manager = await this.getCachedUser(uid);
    await this.ensureManagedUser(manager.user_id, data.user_id);
    const permissionIds = data.permissions.map((item) => item.admin_menus_id);
    if (new Set(permissionIds).size !== permissionIds.length) {
      throw new AppError(BusinessCode.PARAM_ERROR, "权限列表中存在重复菜单");
    }

    const availableMenus = await this.getGrantableMenus(manager);
    const availableIds = new Set(availableMenus.map((item) => item.admin_menus_id));
    const invalidId = permissionIds.find((menuId) => !availableIds.has(menuId));
    if (invalidId) throw new AppError(BusinessCode.FORBIDDEN, `菜单权限 ${invalidId} 不可分配`);

    await this.fastify.db.transaction(async (tx) => {
      await tx.delete(permissions).where(eq(permissions.user_id, data.user_id));
      if (data.permissions.length > 0) {
        await tx.insert(permissions).values(
          data.permissions.map((item) => ({
            user_id: data.user_id,
            admin_menus_id: item.admin_menus_id,
            is_transmit: item.is_transmit,
            is_disabled: false,
            updated_by: manager.user_id,
            created_by: manager.user_id,
          })),
        );
      }
    });
    await this.revokeUserSessions(data.user_id);
  }

  async getInfo(uid: string) {
    const cachedUser = await this.getCachedUser(uid);
    const [user] = await this.fastify.db
      .select({
        user_id: adminUser.user_id,
        parent_id: adminUser.parent_id,
        account: adminUser.account,
        nickname: adminUser.nickname,
        status: adminUser.status,
        created_by: adminUser.created_by,
        remark: adminUser.remark,
        created_at: adminUser.created_at,
        updated_at: adminUser.updated_at,
        deleted_at: adminUser.deleted_at,
      })
      .from(adminUser)
      .where(eq(adminUser.user_id, cachedUser.user_id))
      .limit(1);
    if (!user || user.status === "deleted") throw new AppError(BusinessCode.USER_NOT_FOUND, "用户不存在");
    return user;
  }

  async logout(uid: string) {
    const cached = await this.fastify.redis.get(uid);
    await this.fastify.redis.del(uid);
    if (!cached) return;
    try {
      const user = JSON.parse(cached) as CachedAuthUser;
      if (Number.isInteger(user.user_id)) await this.fastify.redis.srem(this.sessionSetKey(user.user_id), uid);
    } catch {
      // 登录缓存损坏时，删除会话本身即可。
    }
  }

  async login(username: string, password: string) {
    const [row] = await this.fastify.db.select().from(adminUser).where(eq(adminUser.account, username)).limit(1);
    if (!row) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");
    const verification = await verifyPassword(password, row.password);
    if (!verification.valid) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");
    if (row.status !== "normal") throw new AppError(BusinessCode.ADMIN_DISABLED, "账号已被禁用");

    let currentUser = row;
    if (verification.needsRehash) {
      const passwordHash = await hashPassword(password);
      const updatedAt = formatLogTime();
      await this.fastify.db
        .update(adminUser)
        .set({ password: passwordHash, updated_at: updatedAt })
        .where(eq(adminUser.user_id, row.user_id));
      currentUser = { ...row, password: passwordHash, updated_at: updatedAt };
    }

    const { password: _password, ...userInfo } = currentUser;
    const uid = randomUUID();
    const token = await this.fastify.jwt.admin.sign({ uid });
    const decode = this.fastify.jwt.admin.decode<DecodedJwtPayload>(token);
    if (!decode?.exp) throw new AppError(BusinessCode.INTERNAL_ERROR, "服务器错误");
    const ttl = Math.max(decode.exp - Math.floor(Date.now() / 1000), 1);
    const sessionKey = this.sessionSetKey(row.user_id);
    await this.fastify.redis
      .multi()
      .set(uid, JSON.stringify(userInfo), "EX", ttl)
      .sadd(sessionKey, uid)
      .expire(sessionKey, ttl)
      .exec();
    return token;
  }

  private async getGrantableMenus(manager: CachedAuthUser) {
    const fields = {
      admin_menus_id: adminMenus.admin_menus_id,
      type: adminMenus.type,
      parent_id: adminMenus.parent_id,
      meta: adminMenus.meta,
      permission: adminMenus.permission,
      sort: adminMenus.sort,
    };
    if (manager.parent_id === 0) {
      return this.fastify.db
        .select(fields)
        .from(adminMenus)
        .where(eq(adminMenus.is_disabled, false))
        .orderBy(asc(adminMenus.parent_id), asc(adminMenus.sort), asc(adminMenus.admin_menus_id));
    }
    return this.fastify.db
      .select(fields)
      .from(permissions)
      .innerJoin(adminMenus, eq(permissions.admin_menus_id, adminMenus.admin_menus_id))
      .where(
        and(
          eq(permissions.user_id, manager.user_id),
          eq(permissions.is_disabled, false),
          eq(permissions.is_transmit, true),
          eq(adminMenus.is_disabled, false),
        ),
      )
      .orderBy(asc(adminMenus.parent_id), asc(adminMenus.sort), asc(adminMenus.admin_menus_id));
  }

  private async ensureManagedUser(managerId: number, userId: number) {
    const [user] = await this.fastify.db
      .select({ user_id: adminUser.user_id })
      .from(adminUser)
      .where(and(eq(adminUser.user_id, userId), eq(adminUser.parent_id, managerId), ne(adminUser.status, "deleted")))
      .limit(1);
    if (!user) throw new AppError(BusinessCode.USER_NOT_FOUND, "直属子账号不存在");
    return user;
  }

  private async getCachedUser(uid: string) {
    const cached = await this.fastify.redis.get(uid);
    if (!cached) throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态已失效，请重新登录");

    let user: CachedAuthUser;
    try {
      user = JSON.parse(cached) as CachedAuthUser;
    } catch {
      throw new AppError(BusinessCode.UNAUTHORIZED, "登录信息无效，请重新登录");
    }
    if (!Number.isInteger(user.user_id) || user.user_id <= 0) {
      throw new AppError(BusinessCode.UNAUTHORIZED, "登录信息无效，请重新登录");
    }
    return user;
  }

  private async revokeUserSessions(userId: number) {
    const sessionKey = this.sessionSetKey(userId);
    const sessionIds = await this.fastify.redis.smembers(sessionKey);
    if (sessionIds.length === 0) {
      await this.fastify.redis.del(sessionKey);
      return;
    }
    const pipeline = this.fastify.redis.multi();
    sessionIds.forEach((sessionId) => pipeline.del(sessionId));
    pipeline.del(sessionKey);
    await pipeline.exec();
  }

  private sessionSetKey(userId: number) {
    return `${SESSION_SET_PREFIX}${userId}`;
  }
}
