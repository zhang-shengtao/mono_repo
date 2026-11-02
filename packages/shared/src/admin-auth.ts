import { z } from "zod/v4";

/**
 * 管理员认证（auth）前后端契约。
 *
 * 服务端拿 schema 做请求校验 + swagger 文档，admin 端拿类型写页面和 store，
 * 两边共用一份定义，字段改名时不会各改各的。
 */

/** 管理员账号状态：normal 正常 / disabled 禁用 / deleted 已删除 */
export const adminStatusSchema = z.enum(["normal", "disabled", "deleted"]);
export type AdminStatus = z.infer<typeof adminStatusSchema>;

/** 图形验证码：答案只在 Redis 里，接口只下发 SVG 与一次性 ID */
export const captchaResultSchema = z.object({
  captcha_id: z.string().describe("验证码 ID，登录时原样回传"),
  image: z.string().describe("SVG 图片内容，前端用 v-html 渲染"),
});
export type CaptchaResult = z.infer<typeof captchaResultSchema>;

/** 登录请求体 */
export const loginBodySchema = z.object({
  account: z.string().trim().min(1).max(50).describe("管理员账号"),
  password: z.string().min(6).max(128).describe("登录密码，6 至 128 个字符"),
  code: z.string().trim().min(1).max(8).describe("验证码的计算结果"),
  captcha_id: z.string().min(1).max(64).describe("验证码 ID"),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

/** 登录响应：令牌 + 有效期（秒） */
export const loginResultSchema = z.object({
  token: z.string().describe("管理员访问令牌，放在 Authorization: Bearer 里"),
  expires_in: z.number().int().describe("令牌有效期，单位秒"),
});
export type LoginResult = z.infer<typeof loginResultSchema>;

/**
 * 当前登录管理员的对外投影。
 * 只暴露界面需要的字段：密码、备注、时间戳都不下发。
 */
export const adminProfileSchema = z.object({
  user_id: z.number().int().describe("用户 ID"),
  parent_id: z.number().int().min(0).describe("上级用户 ID，0 表示超级管理员"),
  account: z.string().describe("登录账号"),
  nickname: z.string().describe("昵称"),
  status: adminStatusSchema.describe("账号状态"),
});
export type AdminProfile = z.infer<typeof adminProfileSchema>;
