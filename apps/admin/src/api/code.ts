import type { CodeItem, CodeListQuery, CodeListResult, UpdateCodeBody } from "@repo/shared";
import { http } from "@/utils/request";

/** 权限码（code 表）查询：菜单绑定权限码时取候选列表，权限码管理页取全量 */
export function fetchCodeList(params?: CodeListQuery) {
  return http.get<CodeListResult>("/code/list", params as Record<string, unknown> | undefined);
}

/** 修改权限码：只开放备注与启停，返回改完后的整行（含绑定菜单与更新时间） */
export function updateCode(body: UpdateCodeBody) {
  return http.put<CodeItem>("/code/update", body);
}

export type { CodeItem };
