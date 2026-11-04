import type { AdminProfile, LoginBody, LoginResult } from "@repo/shared";
import { fetchProfile, fetchRoutes, login as loginApi, logout as logoutApi } from "@/api/auth";
import router from "@/router";
import { buildRoutes, type AppMenuNode } from "@/router/dynamic";
import { clearToken, getToken, setToken } from "@/utils/request";

const DEFAULT_PROFILE: AdminProfile = {
  user_id: 0,
  parent_id: 0,
  account: "",
  nickname: "管理员",
  status: "normal",
};

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
  const token = ref(getToken());
  const isLogged = computed(() => Boolean(token.value));

  const userInfo = reactive<AdminProfile>({ ...DEFAULT_PROFILE });

  const profile = computed<AdminProfile | null>(() => (userInfo.user_id > 0 ? userInfo : null));

  const routesReady = ref(false);

  const menuList = ref<AppMenuNode[]>([]);

  const removers: (() => void)[] = [];

  function applyProfile(value: AdminProfile | null) {
    Object.assign(userInfo, value ?? DEFAULT_PROFILE);

    userInfo.nickname = value?.nickname?.trim() || value?.account || DEFAULT_PROFILE.nickname;
  }

  async function login(body: LoginBody): Promise<LoginResult> {
    const result = await loginApi(body, { silent: true });
    setToken(result.token);
    token.value = result.token;
    applyProfile(await fetchProfile({ silent: true }).catch(() => null));
    return result;
  }

  async function loadProfile() {
    if (!token.value) return null;
    applyProfile(await fetchProfile({ silent: true }));
    return profile.value;
  }

  async function loadRoutes() {
    const result = await fetchRoutes({ silent: true });
    const { routes, menuTree } = buildRoutes(result.list);

    removeDynamicRoutes();
    routes.forEach((route) => {
      removers.push(router.addRoute(route));
    });

    menuList.value = menuArr(menuTree);
    routesReady.value = true;
  }

  function removeDynamicRoutes() {
    while (removers.length > 0) removers.pop()?.();
  }

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
