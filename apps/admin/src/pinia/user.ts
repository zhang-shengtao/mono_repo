import { routes } from "@/router";
import type { RouteRecordRaw } from "vue-router";

export interface UserInfo {
  /** 显示名 */
  name: string;
  /** 登录账号 */
  account: string;
  /** 头像地址，空则用首字母兜底 */
  avatar?: string;
}

const DEFAULT_USER_INFO: UserInfo = {
  name: "管理员",
  account: "admin",
};

export default defineStore("user", () => {
  const userInfo = ref<UserInfo>({ ...DEFAULT_USER_INFO });
  const menuList = ref<RouteRecordRaw[]>(routes);

  return {
    userInfo,
    menuList,
  };
});
