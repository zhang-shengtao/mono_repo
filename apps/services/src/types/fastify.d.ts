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
import type { PermissionCode } from "@/permissions";
import type { JwtPayload, JwtRealm, RouteAuthConfig } from "@/types/auth";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
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
}

declare global {
  type FastifyInstance = FastifyInstanceBase<RawServerDefault, RawRequestDefaultExpression<RawServerDefault>, RawReplyDefaultExpression<RawServerDefault>, FastifyBaseLoggerBase, ZodTypeProvider>;
  type FastifyRequest = FastifyRequestBase;
  type FastifyReply = FastifyReplyBase;
  type FastifyBaseLogger = FastifyBaseLoggerBase;
}
