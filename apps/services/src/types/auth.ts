import type { PermissionCode } from "@/permissions";

// 生成token传递的 payload
export type JwtPayload = {
  uid: string;
};

/**
 * token 校验器所属的命名空间。
 * 路由通过 config.auth 声明使用哪一套：'admin' 走管理端密钥，'user' 走用户端密钥。
 */
export type JwtRealm = "admin" | "user";

/**
 * 路由鉴权配置（判别联合）：
 * - `auth: "admin"`：管理端 token，可附带权限码
 * - `auth: "user"`：用户端 token，不接受权限码
 * - `auth: "public"`：公开接口，两套校验器都跳过
 *
 * 路由完全不声明 config.auth 时同样视为公开。
 * 用联合类型而不是松散的可选字段，是为了让「用户端路由带 permission」
 * 这类无意义组合在编译期就报错，而不是运行时被静默忽略。
 */
export type RouteAuthConfig = { auth: "admin"; permission?: PermissionCode } | { auth: "user" } | { auth: "public" };

// Redis 中通过 uid 缓存的登录用户信息
export interface CachedAuthUser {
  user_id: number;
  parent_id?: number;
  account: string;
  nickname: string;
  status: "normal" | "disabled" | "deleted";
  [key: string]: unknown;
}

// 解析token返回的 payload
export type DecodedJwtPayload = JwtPayload & {
  iss: string;
  iat: number;
  exp: number;
};
