import type { AuthMenuNode } from "@repo/shared";

/**
 * 动态路由塞进页面 props 的数据。
 *
 * 后端菜单树里的按钮节点是原样传过来的（menus_id / meta.title / permission / sort 都在），
 * 页面想按权限码判断、想拿按钮名称渲染提示、想按 menus_id 排序都能用。
 */
export interface RouteMenuProps {
  /** 当前页面对应的菜单节点（后端原始数据） */
  menu?: AuthMenuNode;
  /** 该页面下所有按钮节点的原始数据 */
  buttons?: AuthMenuNode[];
}

/**
 * 页面里取按钮权限：数据来自路由 props（buildRoutes 时塞进去的）。
 *
 * 用法：
 *   const { has } = usePerms();
 *   <el-button v-if="has('system:role:add')">新增角色</el-button>
 */
export function usePerms() {
  const route = useRoute();

  const props = computed<RouteMenuProps>(() => {
    // vue-router 会把路由上的 props 按「具名视图」收敛成 { default: ... }
    const value = route.matched.at(-1)?.props;
    if (!value || typeof value !== "object") return {};
    const viewProps = (value as Record<string, unknown>).default;
    return viewProps && typeof viewProps === "object" ? (viewProps as RouteMenuProps) : {};
  });

  const buttons = computed(() => props.value.buttons ?? []);

  /** 是否拥有某个权限码：按钮节点的权限码，或页面自己绑的权限码 */
  function has(code: string) {
    return buttons.value.some((item) => item.permission === code) || props.value.menu?.permission === code;
  }

  /** 按权限码取按钮节点原始数据（要按钮名称 / ID 时用） */
  function button(code: string) {
    return buttons.value.find((item) => item.permission === code);
  }

  return { props, buttons, has, button };
}
