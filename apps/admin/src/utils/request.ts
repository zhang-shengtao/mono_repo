/**
 * 全局统一请求封装（基于 ofetch）
 *
 * 外部使用示例：
 *   http.get<MenuTreeResult>("/menu/tree", { keyword: "系统" })
 *   http.post<MenuNode>("/menu/create", body)
 *   http.put<MenuNode>("/menu/update", body)
 *   http.delete<{ menus_id: number }>("/menu/1")
 *   http.post<LoginResult>("/auth/login", body, { silent: true }) // 自己展示错误，不弹 toast
 *
 * 约定：
 *   1. baseURL 取 VITE_API_BASE，dev 下由 vite 代理到后端；
 *   2. 自动带上 Authorization: Bearer <token>，令牌存 localStorage 的 admin:token；
 *   3. 统一解包后端的 { code, message, data, request_id }：code === 200 直接返回 data，
 *      否则抛 RequestError 并弹一个 ElMessage，调用方只需要 catch 住不再提示；
 *   4. 401 会清掉本地令牌并派发 admin:unauthorized 事件，由路由守卫统一跳登录。
 */
import type { ApiResponse } from "@repo/shared";
import { ElMessage } from "element-plus";
import { ofetch, type FetchOptions } from "ofetch";
import { getStorage, removeStorage, setStorage } from "@/utils/storage";

const base_url = import.meta.env.VITE_API_BASE;

/** 令牌的本地存储键：登录成功后写入，请求层与退出逻辑读取 */
export const TOKEN_KEY = "admin:token";

/** 登录态失效时派发的事件名（请求层与路由层解耦用） */
export const UNAUTHORIZED_EVENT = "admin:unauthorized";

/** 业务错误：code 与后端的 BusinessCode 对齐（网络层失败时为 0） */
export class RequestError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export interface RequestOptions extends FetchOptions<"json"> {
  /** 只抛错、不弹全局提示（登录页这类自己展示错误的场景用） */
  silent?: boolean;
}

export function getToken() {
  return getStorage<string>(TOKEN_KEY, "");
}

export function setToken(token: string) {
  setStorage(TOKEN_KEY, token);
}

export function clearToken() {
  removeStorage(TOKEN_KEY);
}

/** ofetch 实例：只负责发请求 + 拼令牌，包络解包交给 request() */
const client = ofetch.create({
  baseURL: base_url,
  timeout: 20000,
  onRequest({ options }) {
    const token = getToken();
    if (!token) return;

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    options.headers = headers;
  },
});

/** 非 2xx 时 ofetch 的异常里带着统一包络，把业务码和消息取出来 */
function readErrorBody(error: unknown) {
  const body = (error as { data?: Partial<ApiResponse<unknown>> } | null)?.data;
  if (!body) return null;

  const code = typeof body.code === "number" ? body.code : 0;
  const message = typeof body.message === "string" ? body.message : "";
  return message ? { code, message } : null;
}

/** dev 下 vite 代理连不上后端时，浏览器拿到的是 502/503/504，统一给一句能照着排查的提示 */
const GATEWAY_STATUS = [502, 503, 504];

function normalizeError(error: unknown) {
  if (error instanceof RequestError) return error;

  const body = readErrorBody(error);
  if (body) return new RequestError(body.code, body.message);

  const status = (error as { status?: number } | null)?.status ?? 0;
  if (GATEWAY_STATUS.includes(status)) {
    return new RequestError(status, `后端服务不可用（${status}），请确认 services 已启动`);
  }

  if (error instanceof Error && error.message) return new RequestError(0, error.message);
  return new RequestError(0, "请求失败，请稍后再试");
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { silent = false, ...fetchOptions } = options;

  try {
    const response = await client<ApiResponse<T>>(url, fetchOptions);
    if (response.code !== 200) throw new RequestError(response.code, response.message);
    return response.data as T;
  } catch (error) {
    const requestError = normalizeError(error);
    if (!silent) ElMessage.error(requestError.message);

    if (requestError.code === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw requestError;
  }
}

export const http = {
  get: <T>(url: string, query?: Record<string, unknown>, options?: RequestOptions) => request<T>(url, { ...options, method: "GET", query }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>(url, { ...options, method: "POST", body: (body ?? null) as Record<string, unknown> | null }),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>(url, { ...options, method: "PUT", body: (body ?? null) as Record<string, unknown> | null }),
  delete: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: "DELETE" }),
};
