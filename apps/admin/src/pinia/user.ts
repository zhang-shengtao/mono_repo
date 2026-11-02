import type { AdminProfile, LoginBody, LoginResult } from "@repo/shared";
import { fetchProfile, login as loginApi, logout as logoutApi } from "@/api/auth";
import { clearToken, getToken, setToken } from "@/utils/request";
import { routes, type RouteRecordRaw } from "@/router";

export interface UserInfo {
  name: string;
  account: string;
  avatar?: string;
}

const DEFAULT_USER_INFO: UserInfo = {
  name: "管理员",
  account: "",
};

// 格式化路径
function formatPath(val1: string, val2 = "") {
  if (val1.startsWith("http")) return val1;
  if (val1 && !val1.startsWith("/")) val1 = "/" + val1;
  if (val2 && !val2.startsWith("/")) val2 = "/" + val2;
  return val2 + val1;
}

function menuArr(allArr: RouteRecordRaw[], path = "") {
  if (allArr.length === 0) return [];
  const arr: RouteRecordRaw[] = [];
  allArr.forEach((page) => {
    const item = { ...page };
    if (item.path != "/") item.path = formatPath(item.path, path);
    if (item.children && item.children.length && item.path != "/") {
      item.children = menuArr(item.children, item.path);
    }
    const isChildren = item.path === "/" && item.children && item.children.length;
    if (!(item.meta?.hidden === true)) isChildren ? arr.push(...menuArr(item.children || [])) : arr.push(item);
  });
  return arr;
}

export default defineStore("user", () => {
  /** 登录态的唯一真相：localStorage 里的 admin:token */
  const token = ref(getToken());
  const profile = ref<AdminProfile | null>(null);
  const isLogged = computed(() => Boolean(token.value));

  /** 顶栏 / 水印直接持有这个对象，赋值一次后随登录信息实时更新 */
  const userInfo = reactive<UserInfo>({ ...DEFAULT_USER_INFO });

  /** 菜单目前仍由静态路由生成，后续做「DB → 动态路由」时只需要换掉这里 */
  const menuList = ref<RouteRecordRaw[]>(menuArr(routes));

  function applyProfile(value: AdminProfile | null) {
    profile.value = value;
    userInfo.name = value?.nickname?.trim() || value?.account || DEFAULT_USER_INFO.name;
    userInfo.account = value?.account ?? "";
  }

  /**
   * 登录：拿令牌 → 落盘 → 顺手拉一次资料。
   * 资料接口抖动不影响登录成功，路由守卫下一次导航还会补拉。
   */
  async function login(body: LoginBody): Promise<LoginResult> {
    const result = await loginApi(body, { silent: true });
    setToken(result.token);
    token.value = result.token;
    applyProfile(await fetchProfile({ silent: true }).catch(() => null));
    return result;
  }

  /** 拉当前登录管理员资料；令牌失效时抛错，交给路由守卫处理 */
  async function loadProfile() {
    if (!token.value) return null;
    applyProfile(await fetchProfile({ silent: true }));
    return profile.value;
  }

  /** 退出：服务端会话删不掉（令牌已失效）也要把本地登录态清干净 */
  async function logout() {
    try {
      await logoutApi({ silent: true });
    } catch {
      // 令牌过期 / 会话不存在都按退出成功处理
    }
    reset();
  }

  function reset() {
    clearToken();
    token.value = "";
    applyProfile(null);
  }

  return {
    token,
    profile,
    isLogged,
    userInfo,
    menuList,
    login,
    loadProfile,
    logout,
    reset,
  };
});
