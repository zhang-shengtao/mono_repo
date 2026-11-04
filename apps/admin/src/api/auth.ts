import type { AdminProfile, AdminRouteResult, CaptchaResult, LoginBody, LoginResult } from "@repo/shared";
import { http, type RequestOptions } from "@/utils/request";

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

export function fetchRoutes(options?: RequestOptions) {
  return http.get<AdminRouteResult>("/auth/routes", undefined, options);
}
