/**
 * layout 的数据仓库（唯一出口）
 *
 * 规则：layout 子目录只能 import 本子目录 + `@/layout` + `@/types` + vue/vueuse。
 * 凡是被多个子目录用到的状态/方法，全部收敛到这里，子目录之间互不引用。
 *
 * 这里只回答「后台长什么样、怎么摆」：
 * 布局状态、菜单派生、页签、主题映射、UI 开关。
 * 不做接口请求、不做鉴权、不同步 document.title。
 */
import { userPinia } from "@/pinia";
import type { MenuItem } from "@/types/menu";

// ============================================================================
// 类型
// ============================================================================
export type LayoutStyle = "side" | "top" | "mix";
export type SwitchPageStyle = "zoom" | "fadeIn" | "3D" | "none";

export interface LayoutSettings {
  /** 侧栏折叠 */
  isCollapse: boolean;
  /** 明暗 */
  theme: "light" | "dark";
  /** 布局：左侧 / 顶部 / 混合 */
  layoutStyle: LayoutStyle;
  /** 页面切换动效 */
  switchPageStyle: SwitchPageStyle;
  /** 显示面包屑 */
  isShowBreadcrumbs: boolean;
  /** 显示多页签 */
  isShowTabs: boolean;
  /** 显示 Logo */
  isShowLogo: boolean;
  /** 主色 */
  primaryColor: string;
  /** 内容宽度 */
  contentWidth: "fluid" | "boxed";
  /** 侧栏明暗 */
  sidebarTheme: "light" | "dark";
  /** 材质：玻璃 / 纯色 */
  material: "glass" | "solid";
  /** 密度 */
  density: "comfortable" | "compact";
}

export interface AppTab {
  path: string;
  fullPath: string;
  name: string;
  title: string;
  affix?: boolean;
  keepAlive?: boolean;
}

// ============================================================================
// 默认值 / 缓存
// ============================================================================
export const LAYOUT_CACHE_KEY = "admin:layout:v1";

export const DEFAULT_LAYOUT_STATE: LayoutSettings = {
  isCollapse: false,
  theme: "light",
  layoutStyle: "side",
  switchPageStyle: "zoom",
  isShowBreadcrumbs: true,
  isShowTabs: true,
  isShowLogo: true,
  primaryColor: "#6366f1",
  contentWidth: "fluid",
  sidebarTheme: "light",
  material: "glass",
  density: "comfortable",
};

/** 布局设置（持久化；mergeDefaults 兜住将来新增字段） */
const settings = useStorage<LayoutSettings>(LAYOUT_CACHE_KEY, DEFAULT_LAYOUT_STATE, localStorage, {
  mergeDefaults: true,
});

// ============================================================================
// 用户 / 菜单（惰性取 store）
//
// 不能在模块顶层直接 userPinia()：一旦有人从静态链路 import 这个模块，
// 求值期 pinia 还没被 app.use() 激活，会抛 getActivePinia() 错误。
// computed 的 getter 是首次访问才执行的，天然安全。
// ============================================================================
let _store: ReturnType<typeof userPinia> | undefined;
const store = () => (_store ??= userPinia());

export const userInfo = computed(() => store().userInfo);
const menuTree = computed<MenuItem[]>(() => store().menuList);

/** 过滤掉不进菜单的项（hidden / button） */
function visibleItems(list: MenuItem[] | undefined): MenuItem[] {
  return (list ?? []).filter((item) => !item.meta.hidden && item.type !== "button");
}

/** 收集所有可见叶子页面（命令面板用） */
function collectPages(list: MenuItem[], out: MenuItem[] = []): MenuItem[] {
  for (const item of visibleItems(list)) {
    if (item.children?.length) collectPages(item.children, out);
    else out.push(item);
  }
  return out;
}

/** 所有可见叶子页面，扁平 */
const flatMenus = computed<MenuItem[]>(() => collectPages(menuTree.value));

/** 顶栏横向菜单的一级项 */
const topMenus = computed<MenuItem[]>(() => visibleItems(menuTree.value));

/** path 命中的一级项（顶栏高亮 / 混合布局取子菜单用） */
function getActiveTop(path: string): MenuItem | undefined {
  return topMenus.value.find((item) =>
    item.children?.length ? path === item.path || path.startsWith(`${item.path}/`) : path === item.path,
  );
}

/** 一级项下第一个可跳转的叶子路径 */
function firstLeafPath(item: MenuItem): string {
  const children = visibleItems(item.children);
  if (children.length) {
    for (const child of children) {
      const path = firstLeafPath(child);
      if (path) return path;
    }
    return "";
  }
  return item.path;
}

/** 侧栏要渲染的菜单：side = 全部一级；mix = 当前一级的子菜单 */
function getSideMenus(path: string): MenuItem[] {
  if (settings.value.layoutStyle !== "mix") return topMenus.value;
  const top = getActiveTop(path);
  return top?.children?.length ? visibleItems(top.children) : topMenus.value;
}

// ============================================================================
// 页签
// ============================================================================
const tabs = ref<AppTab[]>([]);
/** 刷新中转时临时踢出缓存的组件名 */
const refreshExcludes = ref<string[]>([]);

const cachedViews = computed(() =>
  tabs.value
    .filter((tab) => tab.keepAlive !== false && tab.name && !refreshExcludes.value.includes(tab.name))
    .map((tab) => tab.name),
);

function findTab(fullPath: string) {
  return tabs.value.find((tab) => tab.fullPath === fullPath);
}

function addTab(tab: AppTab) {
  if (!tab.name) return;
  const exist = findTab(tab.fullPath);
  if (exist) {
    exist.title = tab.title;
    exist.keepAlive = tab.keepAlive;
    return;
  }
  tabs.value.push(tab);
}

/** 关闭一个页签；返回建议跳转的路径（仅当调用方关闭的是当前页时使用） */
function closeTab(fullPath: string): string | null {
  const index = tabs.value.findIndex((tab) => tab.fullPath === fullPath);
  if (index < 0) return null;
  if (tabs.value[index].affix) return null;

  const [removed] = tabs.value.splice(index, 1);
  refreshExcludes.value = refreshExcludes.value.filter((name) => name !== removed.name);

  const next = tabs.value[index] ?? tabs.value[index - 1];
  return next?.fullPath ?? null;
}

/** 关闭其他（保留固定页签与当前页） */
function closeOthers(fullPath: string) {
  tabs.value = tabs.value.filter((tab) => tab.affix || tab.fullPath === fullPath);
  refreshExcludes.value = refreshExcludes.value.filter((name) => findTab(name) !== undefined);
}

/** 关闭全部（保留固定页签）；返回建议跳转路径 */
function closeAll(): string | null {
  tabs.value = tabs.value.filter((tab) => tab.affix);
  refreshExcludes.value = [];
  return tabs.value[0]?.fullPath ?? null;
}

/** 刷新中转时暂时丢弃缓存，回填后由新实例重新进缓存 */
function suspendCache(name: string) {
  if (!name || refreshExcludes.value.includes(name)) return;
  refreshExcludes.value = [...refreshExcludes.value, name];
}

function resumeCache(name: string) {
  refreshExcludes.value = refreshExcludes.value.filter((item) => item !== name);
}

/** 按菜单里的 affix 标记补齐固定页签 */
function ensureAffixTabs() {
  for (const item of flatMenus.value) {
    if (!item.meta.affix) continue;
    if (findTab(item.path)) continue;
    addTab({
      path: item.path,
      fullPath: item.path,
      name: item.name ?? "",
      title: item.meta.title,
      affix: true,
      keepAlive: item.meta.keepAlive !== false,
    });
  }
}

// ============================================================================
// 主题：把设置映射到 <html> 的 class / data-* / CSS 变量
// 色阶推导全部由 theme.scss 里的 color-mix() 完成，这里不做任何颜色运算
// ============================================================================
const isDark = computed(() => settings.value.theme === "dark");

const transitionName = computed(() => {
  switch (settings.value.switchPageStyle) {
    case "fadeIn":
      return "page-fade";
    case "3D":
      return "page-3d";
    case "zoom":
      return "page-zoom";
    default:
      return "";
  }
});

function applyTheme(state: LayoutSettings) {
  const root = document.documentElement;
  root.classList.toggle("dark", state.theme === "dark");
  root.dataset.layoutStyle = state.layoutStyle;
  root.dataset.material = state.material;
  root.dataset.density = state.density;
  root.dataset.sidebar = state.sidebarTheme;
  root.style.setProperty("--app-primary", state.primaryColor);
}

// 模块被 import 时立即落主题，之后随设置实时更新（immediate 的首帧早于壳渲染）
watch(settings, (state) => applyTheme(state), { deep: true, immediate: true });

// ============================================================================
// UI 状态
// ============================================================================
const isMobile = useMediaQuery("(max-width: 992px)");
const mobileMenuOpen = ref(false);
const isSettingOpen = ref(false);
const isCommandOpen = ref(false);

// ============================================================================
// 动作
// ============================================================================
function toggleCollapse() {
  settings.value.isCollapse = !settings.value.isCollapse;
}

function toggleTheme() {
  settings.value.theme = isDark.value ? "light" : "dark";
}

function toggleMaterial() {
  settings.value.material = settings.value.material === "glass" ? "solid" : "glass";
}

function setPrimaryColor(color: string) {
  settings.value.primaryColor = color;
}

function resetLayout() {
  Object.assign(settings.value, DEFAULT_LAYOUT_STATE);
}

/** 空菜单兜底用：把菜单数据重置回初始数据源 */
function reloadMenus() {
  store().resetUser();
}

function openSetting() {
  isSettingOpen.value = true;
}

function closeSetting() {
  isSettingOpen.value = false;
}

function openCommand() {
  isCommandOpen.value = true;
}

function closeCommand() {
  isCommandOpen.value = false;
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value;
}

function closeMobileMenu() {
  mobileMenuOpen.value = false;
}

// ============================================================================
// 对外：默认导出 reactive 单体
// settings / tabs / userInfo 等 ref、computed 会被 reactive 自动解包
// ============================================================================
export default reactive({
  // 状态
  settings,
  userInfo,
  menuTree,
  flatMenus,
  topMenus,
  tabs,
  cachedViews,
  isDark,
  transitionName,
  isMobile,
  mobileMenuOpen,
  isSettingOpen,
  isCommandOpen,
  // 菜单派生
  getActiveTop,
  firstLeafPath,
  getSideMenus,
  // 页签
  addTab,
  closeTab,
  closeOthers,
  closeAll,
  ensureAffixTabs,
  suspendCache,
  resumeCache,
  // 动作
  toggleCollapse,
  toggleTheme,
  toggleMaterial,
  setPrimaryColor,
  resetLayout,
  reloadMenus,
  openSetting,
  closeSetting,
  openCommand,
  closeCommand,
  toggleMobileMenu,
  closeMobileMenu,
});
