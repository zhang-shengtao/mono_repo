import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { and, eq } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { env } from "@/core/env";
import { adminUser, type AdminUser } from "@/db/admin_user";
import { code } from "@/db/code";
import { permissions } from "@/db/permissions";
import type { PermissionCode } from "@/permissions";
import type { CachedAuthUser, JwtPayload, JwtRealm, RouteAuthConfig } from "@/types/auth";

interface RealmDefinition {
  secret: string;
  issuer: string;
}

const REALMS = {
  admin: { secret: env.ADMIN_JWT_SECRET, issuer: "admin-system" },
  user: { secret: env.USER_JWT_SECRET, issuer: "user-system" },
} as const satisfies Record<JwtRealm, RealmDefinition>;

const REALM_NAMES = Object.keys(REALMS) as JwtRealm[];

const AUTH_MODES = {
  admin: "admin",
  user: "user",
  public: "public",
} as const satisfies Record<RouteAuthConfig["auth"], RouteAuthConfig["auth"]>;

async function jwtPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("uid", "");

  for (const realm of REALM_NAMES) {
    const { secret, issuer } = REALMS[realm];
    await fastify.register(fastifyJwt, {
      namespace: realm,
      secret,
      sign: {
        iss: issuer,
        expiresIn: env.ACCESS_TOKEN_TTL,
      },
      verify: {
        allowedIss: issuer,
      },
    });
  }

  fastify.addHook("onRoute", (route) => {
    const { auth, permission } = route.config ?? {};
    if (auth === undefined) return;
    const methods = Array.isArray(route.method) ? route.method.join("/") : route.method;
    const flag = `${methods} ${route.url}`;
    if (typeof auth !== "string" || !Object.hasOwn(AUTH_MODES, auth)) {
      throw new Error(`${flag} 的 config.auth 非法：${String(auth)}，可选值 ${Object.keys(AUTH_MODES).join(" / ")}`);
    }
    if (permission !== undefined && auth !== AUTH_MODES.admin) {
      throw new Error(`${flag} 声明了 config.permission，但只有 auth: "admin" 会做权限校验`);
    }
  });

  fastify.addHook("preHandler", async (request) => {
    const config = request.routeOptions.config;
    const auth = config?.auth;
    if (!auth || auth === AUTH_MODES.public) return;

    const payload = verifyToken(fastify, auth, request.headers.authorization);

    const session = await readSession(fastify, payload.uid);
    ensureUserUsable(session);

    const userId = toUserId(session);

    request.uid = payload.uid;

    if (auth === AUTH_MODES.admin) {
      const user = await findAdminUser(fastify, userId);
      request.user = user;
      if (config.permission) await ensurePermission(fastify, user, config.permission);
    }
  });
}

function verifyToken(fastify: FastifyInstance, realm: JwtRealm, authorization: string | undefined): JwtPayload {
  if (!authorization) throw new AppError(BusinessCode.UNAUTHORIZED, "授权失败请登录");

  const [scheme, token] = authorization.split(/\s+/);
  if (scheme !== "Bearer" || !token) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权失败请登录");
  }

  let payload: JwtPayload;
  try {
    payload = fastify.jwt[realm].verify<JwtPayload>(token);
  } catch {
    throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态无效，请重新登录");
  }
  if (!payload?.uid) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态无效，请重新登录");
  }

  return payload;
}

async function readSession(fastify: FastifyInstance, uid: string): Promise<CachedAuthUser> {
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

function ensureUserUsable(user: CachedAuthUser) {
  if (user.status === "disabled" || user.status === "deleted") {
    throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
  }
}

async function findAdminUser(fastify: FastifyInstance, userId: number): Promise<AdminUser> {
  const [user] = await fastify.db.select().from(adminUser).where(eq(adminUser.user_id, userId)).limit(1);
  if (!user) throw new AppError(BusinessCode.UNAUTHORIZED, "账号不存在，请重新登录");
  if (user.status !== "normal") throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
  return user;
}

async function ensurePermission(fastify: FastifyInstance, user: AdminUser, permission: PermissionCode) {
  if (user.parent_id === 0) return;

  const rows = await fastify.db
    .select({ code: code.code })
    .from(permissions)
    .innerJoin(code, eq(permissions.menus_id, code.bind_menu_id))
    .where(and(eq(permissions.user_id, user.user_id), eq(permissions.is_disabled, false), eq(code.is_disabled, false), eq(code.code, permission)))
    .limit(1);

  if (rows.length === 0) {
    throw new AppError(BusinessCode.FORBIDDEN, "当前账号无权限访问该资源");
  }
}

function toUserId(user: CachedAuthUser) {
  const userId = Number(user.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(BusinessCode.UNAUTHORIZED, "授权信息无效，请重新登录");
  }
  return userId;
}

export default fp(jwtPlugin, {
  name: "jwt",
});
