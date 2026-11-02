import type { CodeItem, CodeListQuery, CodeListResult } from "@repo/shared";
import { http } from "@/utils/request";

/** 权限码（code 表）查询：菜单绑定权限码时取候选列表 */
export function fetchCodeList(params?: CodeListQuery) {
  return http.get<CodeListResult>("/code/list", params as Record<string, unknown> | undefined);
}

export type { CodeItem };
