import type { CodeItem, CodeListQuery, CodeListResult, UpdateCodeBody } from "@repo/shared";
import { http } from "@/utils/request";

export function fetchCodeList(params?: CodeListQuery) {
  return http.get<CodeListResult>("/code/list", params as Record<string, unknown> | undefined);
}

export function updateCode(body: UpdateCodeBody) {
  return http.put<CodeItem>("/code/update", body);
}

export type { CodeItem };
