import type {
  FastifyBaseLogger as FastifyBaseLoggerBase,
  FastifyInstance as FastifyInstanceBase,
  FastifyReply as FastifyReplyBase,
  FastifyRequest as FastifyRequestBase,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { JWT } from "@fastify/jwt";
import type { FastifyRedis } from "@fastify/redis";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { BusinessCode } from "@repo/shared";
import type { PermissionCode } from "@/permissions";
import type { JwtPayload, RouteAuthConfig } from "@/types/auth";

type JwtNamespace = Omit<JWT, "admin" | "user">;
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
  }
  interface JWT {
    admin: JwtNamespace;
    user: JwtNamespace;
  }
}

declare module "fastify" {
  /**
   * 路由鉴权配置。
   *
   * 这里只放宽地声明字段，真正的形状约束由 `satisfies RouteAuthConfig`（`src/types/auth.ts`）在每个路由声明处把关：
   * 接口无法声明成联合类型，所以「user 路由不能带 permission」这类规则要靠 satisfies 检查。
   */
  interface FastifyContextConfig {
    /**
     * 该路由使用哪套 token 校验：
     * - "admin"：管理端密钥（会额外校验管理员状态与 permission）
     * - "user"：用户端密钥
     * - "public"：公开接口，两套校验器都跳过
     *
     * 未声明时等同于公开（两套校验器都跳过），需要鉴权的路由请显式声明。
     */
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
  type FastifyInstance = FastifyInstanceBase<
    RawServerDefault,
    RawRequestDefaultExpression<RawServerDefault>,
    RawReplyDefaultExpression<RawServerDefault>,
    FastifyBaseLoggerBase,
    ZodTypeProvider
  >;
  type FastifyRequest = FastifyRequestBase;
  type FastifyReply = FastifyReplyBase;
  type FastifyBaseLogger = FastifyBaseLoggerBase;
}
