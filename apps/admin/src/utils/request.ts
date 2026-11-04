import type { ApiResponse } from "@repo/shared";
import { ElMessage } from "element-plus";
import { ofetch, type FetchOptions } from "ofetch";
import { getStorage, removeStorage, setStorage } from "@/utils/storage";

const base_url = import.meta.env.VITE_API_BASE;

export const TOKEN_KEY = "admin:token";

export const UNAUTHORIZED_EVENT = "admin:unauthorized";

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

function readErrorBody(error: unknown) {
  const body = (error as { data?: Partial<ApiResponse<unknown>> } | null)?.data;
  if (!body) return null;

  const code = typeof body.code === "number" ? body.code : 0;
  const message = typeof body.message === "string" ? body.message : "";
  return message ? { code, message } : null;
}

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
