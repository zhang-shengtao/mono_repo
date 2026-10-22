/**
 * 登录态 + 当前账号 + 菜单 + 权限码。
 *
 * 权限判断的唯一依据是 /admin/user/menus 返回的菜单树里带的 permission：
 * 后端按 permissions 表过滤，超管（parent_id === 0）直接返回全量。
 * 前端不内置权限码常量，新增权限码时后台配置完即生效。
 */
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { authApi } from "@/api/auth";
import { BUILTIN_MENUS } from "@/config/builtin-menus";
import type { LoginPayload } from "@/types/auth";
import type { MenuNode } from "@/types/menu";
import type { AdminProfile } from "@/types/user";
import { clearToken, getToken, setToken } from "@/utils/token";
import { collectPermissions, firstPagePath, hasPageMenu } from "@/utils/menu";

export type MenuSource = "database" | "builtin";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(getToken());
  const profile = ref<AdminProfile | null>(null);
  const menus = ref<MenuNode[]>([]);
  const menuSource = ref<MenuSource>("database");
  const permissions = ref<string[]>([]);
  /** 是否已完成一次「拉账号 + 拉菜单」的初始化 */
  const ready = ref(false);

  const isSuperAdmin = computed(() => profile.value?.parent_id === 0);
  const displayName = computed(() => profile.value?.nickname || profile.value?.account || "管理员");
  const roleLabel = computed(() => (isSuperAdmin.value ? "超级管理员" : "子账号"));
  const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase());
  const homePath = computed(() => firstPagePath(menus.value) ?? "/dashboard");

  async function login(payload: LoginPayload): Promise<void> {
    const result = await authApi.login(payload);
    token.value = result.token;
    setToken(result.token);
  }

  async function bootstrap(): Promise<void> {
    const [info, menuResult] = await Promise.all([authApi.profile(), authApi.menus()]);
    profile.value = info;

    const list = menuResult.list ?? [];
    let source: MenuSource = "database";
    let tree = list;

    // 菜单表为空时超管退回内置菜单：表格没有页面节点，侧边栏会一片空白
    if (!hasPageMenu(list) && info.parent_id === 0) {
      tree = BUILTIN_MENUS;
      source = "builtin";
    }

    menus.value = tree;
    menuSource.value = source;
    permissions.value = collectPermissions(tree);
    ready.value = true;
  }

  /** 按钮级权限判断：传空码视为不需要权限 */
  function can(code?: string | null): boolean {
    if (!code) return true;
    if (isSuperAdmin.value) return true;
    return permissions.value.includes(code);
  }

  function reset(): void {
    token.value = "";
    profile.value = null;
    menus.value = [];
    permissions.value = [];
    menuSource.value = "database";
    ready.value = false;
    clearToken();
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 登出接口失败（token 已失效 / 网络问题）不影响本地清理
    }
    reset();
  }

  return {
    token,
    profile,
    menus,
    menuSource,
    permissions,
    ready,
    isSuperAdmin,
    displayName,
    roleLabel,
    avatarText,
    homePath,
    login,
    bootstrap,
    logout,
    reset,
    can,
  };
});
