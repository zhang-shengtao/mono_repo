import { errorResponseSchema, responseSchema } from "@repo/shared";
import type { RouteAuthConfig } from "@/types/auth";
import { z } from "zod/v4";

export const exampleLoginRouteOptions = {
  schema: {
    tags: ["管理员认证"],
    summary: "管理员登录",
    description: "使用用户名和密码登录后台管理系统",
    body: z.object({
      username: z.string().min(1).describe("管理员用户名"),
      password: z.string().min(6).describe("管理员密码，至少 6 位"),
    }),
    response: {
      200: responseSchema(
        z.object({
          token: z.string().describe("管理员访问令牌"),
        }),
      ),
      400: errorResponseSchema,
      401: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    auth: "public",
  } satisfies RouteAuthConfig,
};

export const exampleChatRouteOptions = {
  schema: {
    tags: ["用户聊天"],
    summary: "sse协议接口",
    description: "sse用户问答接口",
    body: z.object({
      name: z.string().min(1).describe("用户名"),
    }),
  },
  config: {
    auth: "public",
  } satisfies RouteAuthConfig,
};

export const exampleWsRouteOptions = {
  schema: {
    tags: ["用户聊天ws"],
    summary: "websocket协议接口",
    description: "websocket聊天接口",
    querystring: z.object({
      name: z.string().min(1).describe("用户名"),
    }),
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  config: {
    auth: "public",
  } satisfies RouteAuthConfig,
};

export interface ChatData {
  type: string;
  data: {
    id: string;
    name: string;
    message: string;
  };
}
