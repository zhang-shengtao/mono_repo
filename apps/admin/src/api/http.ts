import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { ElMessage } from "element-plus";
import { BusinessCode } from "@repo/shared";
import type { ApiResponse } from "@/types/api";
import { clearToken, getToken } from "@/utils/token";

/**
 * 统一请求层。
 *
 * 约定（来自 apps/services 的 reply.success / reply.error）：
 * - HTTP 2xx 且 code === 200 → 取出 data 直接给业务
 * - HTTP 2xx 但 code !== 200 → 视为业务失败（理论上后端不会这么发，防御式处理）
 * - HTTP 4xx / 5xx → axios 抛错，这里读包络里的 message 提示
 * - HTTP 401 → 清 token 并交给 auth 那边跳登录，登录接口本身的 401 除外
 */
export class ApiError extends Error {
  readonly code: number;
  readonly requestId: string;

  constructor(code: number, message: string, requestId = "") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.requestId = requestId;
  }
}

/** 由 router 注入：登录态失效时清状态 + 跳登录页 */
let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "",
  timeout: 20000,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<null>>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message = body?.message || (status ? `请求失败（HTTP ${status}）` : "网络异常，请确认后端服务已启动");
    const apiError = new ApiError(body?.code ?? status, message, body?.request_id ?? "");

    // 登录 / 验证码接口的 401 属于业务提示，不是登录态失效
    const silent = isAuthEndpoint(error.config?.url);
    if (status === BusinessCode.UNAUTHORIZED && !silent) {
      clearToken();
      unauthorizedHandler?.();
      return Promise.reject(apiError);
    }
    if (!silent) ElMessage.error(message);
    return Promise.reject(apiError);
  },
);

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return url.includes("/admin/user/login") || url.includes("/admin/captcha/image");
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as ApiResponse<unknown>).code === "number"
  );
}

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiResponse<T>>(config);
  const body = response.data;
  if (!isApiResponse(body)) return body as unknown as T;

  if (body.code !== BusinessCode.SUCCESS) {
    ElMessage.error(body.message || "请求失败");
    throw new ApiError(body.code, body.message || "请求失败", body.request_id);
  }
  return body.data as T;
}
