import type { AdminProfile, LoginBody, LoginResult } from "@repo/shared";
import { fetchProfile, fetchRoutes, login as loginApi, logout as logoutApi } from "@/api/auth";
import router, { notFoundRoute } from "@/router";
import { buildRoutes, type AppMenuNode } from "@/router/dynamic";
import { clearToken, getToken, setToken } from "@/utils/request";

/**
 * 未登录 / 资料还没到位时的占位。
 * 用 AdminProfile 而不是另造一个「界面专用」类型：顶栏、水印、权限判断读的都是这一份，
 * 类型跟后端 /admin/auth/profile 的返回值保持一致，字段名对不上时编译期就会报错。
 */
const DEFAULT_PROFILE: AdminProfile = {
  user_id: 0,
  parent_id: 0,
  account: "",
  nickname: "管理员",
  status: "normal",
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
  const isLogged = computed(() => Boolean(token.value));

  /**
   * 当前登录管理员：登录人状态的唯一一份。
   * 恒为 AdminProfile（未登录用占位），界面不必到处判空；信息变了就地改写、不换对象引用，
   * 因为 layout 是 setup 时把引用接走的。
   */
  const userInfo = reactive<AdminProfile>({ ...DEFAULT_PROFILE });

  /** 资料是否真的拉到了（未登录 / 拉取失败为 null），守卫据此决定要不要补拉 */
  const profile = computed<AdminProfile | null>(() => (userInfo.user_id > 0 ? userInfo : null));

  /** 动态路由是否已注册：守卫据此决定要不要拉菜单 */
  const routesReady = ref(false);
  /** 侧栏菜单：由后端菜单树构建出来的路由树经 menuArr 拍平 */
  const menuList = ref<AppMenuNode[]>([]);

  /** 运行时 addRoute 返回的卸载函数，登出时按它精确摘掉 */
  const removers: (() => void)[] = [];

  function applyProfile(value: AdminProfile | null) {
    Object.assign(userInfo, value ?? DEFAULT_PROFILE);
    // 昵称可能是空串，顶栏显示一片空白不如退回账号
    userInfo.nickname = value?.nickname?.trim() || value?.account || DEFAULT_PROFILE.nickname;
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
