/** 展示用字典：后端只返回枚举值，文案与颜色在前端维护 */
import type { MenuType } from "@/types/menu";
import type { UserStatus } from "@/types/user";

export const MENU_TYPE_LABEL: Record<MenuType, string> = {
  directory: "目录",
  page: "页面",
  button: "按钮",
};

export type TagType = "primary" | "success" | "info" | "warning" | "danger";

export const MENU_TYPE_TAG: Record<MenuType, TagType> = {
  directory: "primary",
  page: "success",
  button: "warning",
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  normal: "正常",
  disabled: "已禁用",
  deleted: "已删除",
};

export const USER_STATUS_TAG: Record<UserStatus, TagType> = {
  normal: "success",
  disabled: "danger",
  deleted: "info",
};
