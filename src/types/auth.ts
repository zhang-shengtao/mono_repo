// 生成token传递的 payload
export type JwtPayload = {
  uid: string;
};

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
