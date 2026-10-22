import { z } from "zod/v4";

/**
 * 统一响应包络。api 用它生成 OpenAPI 响应 schema，admin 端用它校验/推导响应类型，
 * 两边共用一份定义，避免「后端加了字段、前端还在报缺字段」。
 */
export function responseSchema<T extends z.ZodType>(data: T) {
  return z.object({
    code: z.number().describe("业务状态码"),
    message: z.string().describe("响应消息"),
    data: z.union([data, z.null()]),
    request_id: z.string().describe("请求 ID"),
  });
}

export const errorResponseSchema = z.object({
  code: z.number().describe("业务状态码，与 HTTP 状态码保持一致"),
  message: z.string().describe("错误消息"),
  data: z.null().describe("错误响应固定为 null"),
  request_id: z.string().describe("请求 ID"),
});
