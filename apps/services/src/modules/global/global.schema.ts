import { responseSchema, errorResponseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { z } from "zod/v4";

export const healthRouteOptions = {
  schema: {
    tags: ["健康检查"],
    summary: "服务就绪检查",
    description: "检查服务进程、Redis 和 PostgreSQL 是否可用",
    response: {
      200: responseSchema(
        z.object({
          redis: z.string().describe("Redis PING 返回值"),
          database: z.string().describe("数据库状态"),
          uptime: z.number().describe("当前时间戳"),
        }),
      ),
      500: errorResponseSchema,
    },
  },
  config: {
    auth: "public",
  } satisfies RouteAuthConfig,
};

export const captchaRouteOptions = {
  schema: {
    tags: ["验证码"],
    summary: "获取验图片证码",
    description: "获取验图片证码",
    response: {
      200: responseSchema(
        z.object({
          image: z.string().describe("图片验证码"),
          captcha_id: z.string().describe("图片验证码的ID"),
        }),
      ),
      500: errorResponseSchema,
    },
  },
  config: {
    auth: "public",
  } satisfies RouteAuthConfig,
};
