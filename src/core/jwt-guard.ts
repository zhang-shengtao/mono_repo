import fastifyJwt from "@fastify/jwt";
import { and, eq } from "drizzle-orm";
import { AppError, BusinessCode } from "@/core/app-error";
import { adminUser } from "@/db/admin-user";
import { code } from "@/db/code";
import { permissions } from "@/db/permissions";
import type { PermissionCode } from "@/permissions";
import type { CachedAuthUser, JwtPayload, JwtRealm } from "@/types/auth";

interface JwtGuardOptions {
  /** 本校验器负责的命名空间，与路由 config.auth 对应 */
  realm: JwtRealm;
  secret: string;
  issuer: string;
  expiresIn: string;
}

interface JwtVerifier {
  verify<T>(token: string): T;
}

/**
 * 生成一套 token 校验器。
 *
 * 命中规则完全由路由的 `config.auth` 决定（不再依赖 URL 前缀）：
 * - `config.auth === "admin"` → 只有 admin 校验器会执行
 * - `config.auth === "user"`  → 只有 user 校验器会执行
 * - `config.auth === false`   → 两套都跳过
 */
export function createJwtGuard(options: JwtGuardOptions) {
  return async function jwtGuard(fastify: FastifyInstance) {
    await fastify.register(fastifyJwt, {
      namespace: options.realm,
      secret: options.secret,
      sign: {
        iss: options.issuer,
        expiresIn: options.expiresIn,
      },
      verify: {
        allowedIss: options.issuer,
      },
    });

    fastify.addHook("preHandler", async (request) => {
      const config = request.routeOptions.config;
      // 不是本校验器负责的路由（含公开接口）直接放行，由另一套校验器处理
      if (config?.auth !== options.realm) return;

      const payload = verifyRequestToken(fastify, options.realm, request.headers.authorization);
      const cachedUser = await getCachedUser(fastify, payload.uid);
      ensureUserAvailable(cachedUser);

      if (options.realm === "admin") {
        await ensureAdminUserAvailable(fastify, cachedUser);
        if (config.permission) await ensurePermission(fastify, cachedUser, config.permission);
      }

      request.user = payload;
    });
  };
}

function verifyRequestToken(fastify: FastifyInstance, realm: JwtRealm, authorization: string | undefined) {
  if (!authorization) throw new AppError(BusinessCode.UNAUTHORIZED, "授权失败请登录");

  const [scheme, token] = authorization.split(/\s+/);
  if (scheme !== "Bearer" || !token) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权失败请登录");
  }

  const jwt = fastify.jwt[realm] as JwtVerifier;
  let payload: JwtPayload;
  try {
    payload = jwt.verify<JwtPayload>(token);
  } catch {
    throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态无效，请重新登录");
  }
  if (!payload?.uid) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态无效，请重新登录");
  }

  return payload;
}

async function getCachedUser(fastify: FastifyInstance, uid: string) {
  const cached = await fastify.redis.get(uid);
  if (!cached) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权失败请登录");
  }

  try {
    return JSON.parse(cached) as CachedAuthUser;
  } catch {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权信息无效，请重新登录");
  }
}

function ensureUserAvailable(user: CachedAuthUser) {
  if (user.status === "disabled" || user.status === "deleted") {
    throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
  }
}

async function ensureAdminUserAvailable(fastify: FastifyInstance, user: CachedAuthUser) {
  const userId = Number(user.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权信息无效，请重新登录");
  }
  const [currentUser] = await fastify.db
    .select({ status: adminUser.status })
    .from(adminUser)
    .where(eq(adminUser.user_id, userId))
    .limit(1);
  if (!currentUser) throw new AppError(BusinessCode.UNAUTHORIZED, "账号不存在，请重新登录");
  if (currentUser.status !== "normal") throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
}

async function ensurePermission(fastify: FastifyInstance, user: CachedAuthUser, permission: PermissionCode) {
  if (user.parent_id === 0) return;

  const userId = Number(user.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权信息无效，请重新登录");
  }

  const rows = await fastify.db
    .select({ code: code.code })
    .from(permissions)
    .innerJoin(code, eq(permissions.admin_menus_id, code.bind_menu_id))
    .where(
      and(
        eq(permissions.user_id, userId),
        eq(permissions.is_disabled, false),
        eq(code.is_disabled, false),
        eq(code.code, permission),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    throw new AppError(BusinessCode.FORBIDDEN, "当前账号无权限访问该资源");
  }
}
