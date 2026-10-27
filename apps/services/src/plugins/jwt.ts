import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { and, eq } from "drizzle-orm";
import { BusinessCode } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { env } from "@/core/env";
import { adminUser } from "@/db/admin_user";
import { code } from "@/db/code";
import { permissions } from "@/db/permissions";
import type { PermissionCode } from "@/permissions";
import type { CachedAuthUser, JwtPayload, JwtRealm, RouteAuthConfig } from "@/types/auth";

/** 一套身份的签发与校验参数 */
interface RealmDefinition {
  secret: string;
  issuer: string;
}

/**
 * 全部 JWT 命名空间。注册、启动期校验都在读这张表，新增一套身份只需补一行。
 * issuer 不开放环境变量：两套 issuer 不同，admin 签发的 token 拿不到 user 接口上，反之亦然。
 */
const REALMS = {
  admin: { secret: env.ADMIN_JWT_SECRET, issuer: "admin-system" },
  user: { secret: env.USER_JWT_SECRET, issuer: "user-system" },
} as const satisfies Record<JwtRealm, RealmDefinition>;

const REALM_NAMES = Object.keys(REALMS) as JwtRealm[];

/**
 * config.auth 的合法取值。`satisfies Record<...>` 是双向穷尽的：
 * RouteAuthConfig 增删分支而这里没跟着改，会直接编译报错。
 */
const AUTH_MODES = {
  admin: "admin",
  user: "user",
  public: "public",
} as const satisfies Record<RouteAuthConfig["auth"], RouteAuthConfig["auth"]>;

/**
 * JWT 鉴权插件：一个文件管完两套身份。
 *
 * 1. 按 REALMS 表注册 @fastify/jwt 的命名空间（`fastify.jwt.admin` / `fastify.jwt.user`）；
 * 2. onRoute：启动阶段校验路由的 config.auth 声明，写错在启动就失败；
 * 3. preHandler：只跑一个钩子，按路由的 config.auth 选命名空间，校验通过后写 request.user。
 *
 * 路由通过 `config: { auth: "admin" | "user" | "public" } satisfies RouteAuthConfig` 声明所需身份；
 * 未声明等同公开（`auth: "public"` 与不声明完全一致）。
 */
async function jwtPlugin(fastify: FastifyInstance) {
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

  // 必须早于业务路由注册（plugins/ 先于 modules/ 加载），否则钩子看不到路由声明
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
    // 会话只认登录时写进 Redis 的那份，所以登出（删 key）= 令牌立刻失效
    const user = await readSession(fastify, payload.uid);
    ensureUserUsable(user);

    if (auth === AUTH_MODES.admin) {
      await ensureAdminUsable(fastify, user);
      if (config.permission) await ensurePermission(fastify, user, config.permission);
    }
    request.user = payload;
  });
}

/** 取 Bearer token 并用对应命名空间验签（签名、issuer、有效期都由 @fastify/jwt 校验） */
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

/** 读取登录时写入的用户快照；key 就是 JWT 里的 uid */
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

/** 快照里的状态兜底：账号被禁用/删除后，即便会话还在 Redis 里也不放行 */
function ensureUserUsable(user: CachedAuthUser) {
  if (user.status === "disabled" || user.status === "deleted") {
    throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
  }
}

/** 管理端额外回查数据库：快照可能是登录时的旧数据，以库里状态为准 */
async function ensureAdminUsable(fastify: FastifyInstance, user: CachedAuthUser) {
  const userId = toUserId(user);
  const [currentUser] = await fastify.db.select({ status: adminUser.status }).from(adminUser).where(eq(adminUser.user_id, userId)).limit(1);
  if (!currentUser) throw new AppError(BusinessCode.UNAUTHORIZED, "账号不存在，请重新登录");
  if (currentUser.status !== "normal") throw new AppError(BusinessCode.FORBIDDEN, "账号已被禁用");
}

/** 权限以数据库为准：permissions × code 联查；超管（parent_id === 0）跳过查库 */
async function ensurePermission(fastify: FastifyInstance, user: CachedAuthUser, permission: PermissionCode) {
  if (user.parent_id === 0) return;

  const userId = toUserId(user);
  const rows = await fastify.db
    .select({ code: code.code })
    .from(permissions)
    .innerJoin(code, eq(permissions.menus_id, code.bind_menu_id))
    .where(and(eq(permissions.user_id, userId), eq(permissions.is_disabled, false), eq(code.is_disabled, false), eq(code.code, permission)))
    .limit(1);

  if (rows.length === 0) {
    throw new AppError(BusinessCode.FORBIDDEN, "当前账号无权限访问该资源");
  }
}

/** user_id 来自 Redis 里的 JSON，可能是脏数据，查库前先收敛成正整数 */
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
