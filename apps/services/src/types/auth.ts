import type { PermissionCode } from "@/permissions";

export type JwtPayload = {
  uid: string;
};

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
