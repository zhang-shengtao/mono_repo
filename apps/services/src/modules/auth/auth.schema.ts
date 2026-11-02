import { adminProfileSchema, captchaResultSchema, errorResponseSchema, loginBodySchema, loginResultSchema, responseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { z } from "zod/v4";

/**
 * 认证接口的「形状」已经下沉到 @repo/shared（admin-auth.ts）：
 * 这里只保留 Fastify 侧的东西——标签、摘要、错误码、权限声明。
 */
const emptyResponseSchema = responseSchema(z.object({}));

/** 登录相关接口会主动返回这些错误码，其余按通用错误处理 */
const authErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  500: errorResponseSchema,
};

export const captchaRouteOptions = {
  schema: {
    tags: ["管理员认证"],
    summary: "获取图形验证码",
    description: "生成算式验证码，答案在 Redis 中保存 60 秒；登录成功或失败后即作废，需要重新获取",
    response: {
      200: responseSchema(captchaResultSchema),
      500: errorResponseSchema,
    },
  },
  config: { auth: "public" } satisfies RouteAuthConfig,
};

export const loginRouteOptions = {
  schema: {
    tags: ["管理员认证"],
    summary: "管理员登录",
    description: "校验验证码 + 账号密码，成功后签发 admin JWT，并在 Redis 里登记会话",
    body: loginBodySchema,
    response: {
      200: responseSchema(loginResultSchema),
      ...authErrorResponses,
    },
  },
  config: { auth: "public" } satisfies RouteAuthConfig,
};

export const profileRouteOptions = {
  schema: {
    tags: ["管理员认证"],
    summary: "获取当前登录管理员",
    response: {
      200: responseSchema(adminProfileSchema),
      ...authErrorResponses,
    },
  },
  config: { auth: "admin" } satisfies RouteAuthConfig,
};

export const logoutRouteOptions = {
  schema: {
    tags: ["管理员认证"],
    summary: "管理员退出登录",
    description: "删除 Redis 中的当前会话，令牌随即失效",
    response: {
      200: emptyResponseSchema,
      ...authErrorResponses,
    },
  },
  config: { auth: "admin" } satisfies RouteAuthConfig,
};
