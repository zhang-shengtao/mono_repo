/** 权限码的查询与启停（权限码本身由后端种子脚本同步，前端只读 + 启停） */
import type { CodeFilterQuery, CodeListQuery, CodeListResult, PermissionCodeItem } from "@/types/code";
import { request } from "./http";

export const codeApi = {
  list: (params: CodeListQuery) => request<CodeListResult>({ url: "/admin/code/list", method: "get", params }),

  /** 不分页，供「菜单绑定权限码」下拉框使用 */
  filter: (params: CodeFilterQuery = {}) =>
    request<{ list: PermissionCodeItem[] }>({ url: "/admin/code/filter", method: "get", params }),

  setDisabled: (code: string, isDisabled: boolean) =>
    request<Record<string, unknown>>({
      url: "/admin/code/list",
      method: "put",
      data: { code, is_disabled: isDisabled },
    }),
};
