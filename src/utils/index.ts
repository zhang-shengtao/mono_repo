import { z } from "zod/v4";

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

export function formatLogTime(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
