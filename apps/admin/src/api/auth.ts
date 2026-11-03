import type { AdminProfile, AdminRouteResult, CaptchaResult, LoginBody, LoginResult } from "@repo/shared";
import { http, type RequestOptions } from "@/utils/request";

/**
 * 认证接口：参数 / 响应类型统一来自 @repo/shared 的 admin-auth.ts。
 * silent 只给登录页和路由守卫用——它们自己处理错误与跳转，不需要全局 toast。
 */
export function fetchCaptcha(options?: RequestOptions) {
  return http.get<CaptchaResult>("/auth/captcha", undefined, options);
}

export function login(body: LoginBody, options?: RequestOptions) {
  return http.post<LoginResult>("/auth/login", body, options);
}

export function logout(options?: RequestOptions) {
  return http.post<Record<string, never>>("/auth/logout", undefined, options);
}

export function fetchProfile(options?: RequestOptions) {
  return http.get<AdminProfile>("/auth/profile", undefined, options);
}

/** 当前登录人可见的菜单（动态路由 + 按钮权限的数据源） */
export function fetchRoutes(options?: RequestOptions) {
  return http.get<AdminRouteResult>("/auth/routes", undefined, options);
}
