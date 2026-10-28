// 用户状态：用户信息 + 菜单权限数据（最终形态由后端下发，布局只负责消费）
import { MOCK_MENU_LIST } from "@/mock/menu";
import type { MenuItem } from "@/types/menu";

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
  // 本轮用本地 mock 初始化；后端接口就绪后只改这里（buildMenuTree + setMenuList）
  const menuList = ref<MenuItem[]>(MOCK_MENU_LIST);

  function setUserInfo(info: Partial<UserInfo>) {
    userInfo.value = { ...userInfo.value, ...info };
  }

  function setMenuList(list: MenuItem[]) {
    menuList.value = list;
  }

  function resetUser() {
    userInfo.value = { ...DEFAULT_USER_INFO };
    menuList.value = MOCK_MENU_LIST;
  }

  return {
    userInfo,
    menuList,
    setUserInfo,
    setMenuList,
    resetUser,
  };
});
