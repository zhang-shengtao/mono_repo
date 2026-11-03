import type {
  FastifyBaseLogger as FastifyBaseLoggerBase,
  FastifyInstance as FastifyInstanceBase,
  FastifyReply as FastifyReplyBase,
  FastifyRequest as FastifyRequestBase,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { FastifyRedis } from "@fastify/redis";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { BusinessCode } from "@repo/shared";
import type { AdminUser } from "@/db/admin_user";
import type { PermissionCode } from "@/permissions";
import type { JwtPayload, JwtRealm, RouteAuthConfig } from "@/types/auth";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    /**
     * request.user 的类型，直接复用 db 导出的表类型，路由里因此有完整字段提示。
     * 鉴权通过后是 admin_user 的整行数据（含 password，切勿原样返回给前端）；
     * 未鉴权（public）时为 null。
     */
    user: AdminUser | null;
    /** 与 plugins/jwt.ts 的 REALMS 表一一对应：fastify.jwt 因此是 realm → JWT 的映射 */
    namespaces: JwtRealm;
  }
}

declare module "fastify" {
  interface FastifyContextConfig {
    auth?: RouteAuthConfig["auth"];
    /** 需要的权限码，仅 auth: "admin" 时生效 */
    permission?: PermissionCode;
  }

  interface FastifyInstance {
    redis: FastifyRedis;
    db: NodePgDatabase;
  }

  interface FastifyReply {
    success<T>(data: T, message?: string, code?: BusinessCode): FastifyReplyBase;
    error(message: string, code?: BusinessCode): FastifyReplyBase;
  }

  interface FastifyRequest {
    /** 当前会话在 Redis 里的 key（就是 JWT 里的 uid），登出时要靠它删会话 */
    uid: string;
  }
}

declare global {
  type FastifyInstance = FastifyInstanceBase<RawServerDefault, RawRequestDefaultExpression<RawServerDefault>, RawReplyDefaultExpression<RawServerDefault>, FastifyBaseLoggerBase, ZodTypeProvider>;
  type FastifyRequest = FastifyRequestBase;
  type FastifyReply = FastifyReplyBase;
  type FastifyBaseLogger = FastifyBaseLoggerBase;
}
