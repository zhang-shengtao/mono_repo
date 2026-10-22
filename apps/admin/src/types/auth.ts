/** 登录 / 验证码相关类型 */

export interface CaptchaResult {
  captcha_id: string;
  /** SVG 字符串，直接 v-html 渲染 */
  image: string;
}

export interface LoginPayload {
  username: string;
  password: string;
  /** 验证码答案（算式结果） */
  code: string;
  captcha_id: string;
}

export interface LoginResult {
  token: string;
}
