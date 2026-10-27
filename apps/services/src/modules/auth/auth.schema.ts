import { errorResponseSchema, responseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { z } from "zod/v4";

/** 登录验证码：Redis 里的一次性答案 + 前端回传的 captcha_id */
const captchaResponseSchema = z.object({
  captcha_id: z.string().describe("验证码 ID，登录时原样回传"),
  image: z.string().describe("SVG 图片内容，前端用 v-html 渲染"),
});

const loginBodySchema = z.object({
  account: z.string().trim().min(1).max(50).describe("管理员账号"),
  password: z.string().min(6).max(128).describe("登录密码，6 至 128 个字符"),
  code: z.string().trim().min(1).max(8).describe("验证码的计算结果"),
  captcha_id: z.string().min(1).max(64).describe("验证码 ID"),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

const loginResponseSchema = z.object({
  token: z.string().describe("管理员访问令牌，放在 Authorization: Bearer 里"),
  expires_in: z.number().int().describe("令牌有效期，单位秒"),
});

/**
 * 当前登录管理员的对外投影。
 * 只暴露界面需要的字段：密码、备注、时间戳都不下发。
 */
const adminProfileSchema = z.object({
  user_id: z.number().int().describe("用户 ID"),
  parent_id: z.number().int().min(0).describe("上级用户 ID，0 表示超级管理员"),
  account: z.string().describe("登录账号"),
  nickname: z.string().describe("昵称"),
  status: z.enum(["normal", "disabled", "deleted"]).describe("账号状态"),
});
export type AdminProfile = z.infer<typeof adminProfileSchema>;

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
      200: responseSchema(captchaResponseSchema),
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
      200: responseSchema(loginResponseSchema),
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
