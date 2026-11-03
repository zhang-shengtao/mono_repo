import type { AdminProfile, LoginBody, LoginResult } from "@repo/shared";
import { fetchProfile, fetchRoutes, login as loginApi, logout as logoutApi } from "@/api/auth";
import router, { notFoundRoute } from "@/router";
import { buildRoutes, type AppMenuNode } from "@/router/dynamic";
import { clearToken, getToken, setToken } from "@/utils/request";

export interface UserInfo {
  name: string;
  account: string;
  avatar?: string;
}

const DEFAULT_USER_INFO: UserInfo = {
  name: "管理员",
  account: "",
};

/**
 * 菜单树 → 侧栏菜单。
 * 只做两件事：拍平 `/` 这层 layout 壳、剔除 meta.hidden 的节点。
 * path 在 buildRoutes 里已经是完整路径，这里不再拼。
 */
function menuArr(nodes: AppMenuNode[]): AppMenuNode[] {
  const result: AppMenuNode[] = [];

  for (const node of nodes) {
    if (node.meta?.hidden === true) continue;

    if (node.path === "/" && node.children?.length) {
      result.push(...menuArr(node.children));
      continue;
    }

    result.push(node.children?.length ? { ...node, children: menuArr(node.children) } : node);
  }

  return result;
}

export default defineStore("user", () => {
  /** 登录态的唯一真相：localStorage 里的 admin:token */
  const token = ref(getToken());
  const profile = ref<AdminProfile | null>(null);
  const isLogged = computed(() => Boolean(token.value));

  /** 顶栏 / 水印直接持有这个对象，赋值一次后随登录信息实时更新 */
  const userInfo = reactive<UserInfo>({ ...DEFAULT_USER_INFO });

  /** 动态路由是否已注册：守卫据此决定要不要拉菜单 */
  const routesReady = ref(false);
  /** 侧栏菜单：由后端菜单树构建出来的路由树经 menuArr 拍平 */
  const menuList = ref<AppMenuNode[]>([]);

  /** 运行时 addRoute 返回的卸载函数，登出时按它精确摘掉 */
  const removers: (() => void)[] = [];

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

  /**
   * 拉菜单 → 构建路由 → 注册 → 生成侧栏。
   * 失败（401 / 网络）直接抛错，由守卫统一清登录态。
   */
  async function loadRoutes() {
    const result = await fetchRoutes({ silent: true });
    const { routes, menuTree } = buildRoutes(result.list);

    removeDynamicRoutes();
    routes.forEach((route) => {
      removers.push(router.addRoute(route));
    });
    // 兜底必须最后挂：先挂的话，动态路由还没加完就被它截胡了
    removers.push(router.addRoute(notFoundRoute));

    menuList.value = menuArr(menuTree);
    routesReady.value = true;
  }

  function removeDynamicRoutes() {
    while (removers.length > 0) removers.pop()?.();
  }

  /** 退出：服务端会话删不掉（令牌已失效）也要把本地登录态、动态路由清干净 */
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
    removeDynamicRoutes();
    routesReady.value = false;
    menuList.value = [];
  }

  return {
    token,
    profile,
    isLogged,
    routesReady,
    userInfo,
    menuList,
    login,
    loadProfile,
    loadRoutes,
    logout,
    reset,
  };
});
