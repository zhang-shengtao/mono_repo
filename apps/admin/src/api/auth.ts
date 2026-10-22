/** 管理端认证：验证码 / 登录 / 当前账号 / 当前菜单 / 登出 */
import type { CaptchaResult, LoginPayload, LoginResult } from "@/types/auth";
import type { MenuNode } from "@/types/menu";
import type { AdminProfile } from "@/types/user";
import { request } from "./http";

export const authApi = {
  captcha: () => request<CaptchaResult>({ url: "/admin/captcha/image", method: "get" }),

  login: (data: LoginPayload) => request<LoginResult>({ url: "/admin/user/login", method: "post", data }),

  profile: () => request<AdminProfile>({ url: "/admin/user/info", method: "get" }),

  /** 当前账号可访问的菜单树（服务端已按权限过滤并补齐父级目录） */
  menus: () => request<{ list: MenuNode[] }>({ url: "/admin/user/menus", method: "get" }),

  logout: () => request<Record<string, unknown>>({ url: "/admin/user/logout", method: "post" }),
};
