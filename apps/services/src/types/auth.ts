import type { PermissionCode } from "@/permissions";

export type JwtPayload = {
  uid: string;
};

/**
 * token 校验器所属的命名空间。
 * 路由通过 config.auth 声明使用哪一套：'admin' 走管理端密钥，'user' 走用户端密钥。
 */
export type JwtRealm = "admin" | "user";

export type RouteAuthConfig = { auth: "admin"; permission?: PermissionCode } | { auth: "user" } | { auth: "public" };

export interface CachedAuthUser {
  user_id: number;
  parent_id?: number;
  account: string;
  nickname: string;
  status: "normal" | "disabled" | "deleted";
  [key: string]: unknown;
}

export type DecodedJwtPayload = JwtPayload & {
  iss: string;
  iat: number;
  exp: number;
};
