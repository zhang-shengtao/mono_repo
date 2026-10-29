import type { RouteRecordRaw } from "vue-router";

export type LayoutStyle = "side" | "top" | "mix";
export type SwitchPageStyle = "zoom" | "fadeIn" | "slide" | "rise" | "blur" | "3D" | "flip" | "reveal" | "none";
export type AppTheme = "light" | "dark" | "auto";

export interface LayoutUserInfo {
  name: string;
  account: string;
  avatar?: string;
}

export interface AppTab {
  path: string;
  fullPath: string;
  name: string;
  title: string;
}

export interface LayoutSettings {
  menuList: RouteRecordRaw[];
  isCollapse: boolean;
  theme: AppTheme;
  layoutStyle: LayoutStyle;
  switchPageStyle: SwitchPageStyle;
  isShowBreadcrumbs: boolean;
  isShowTabs: boolean;
  isShowLogo: boolean;
  primaryColor: string;
  sidebarTheme: "light" | "dark";
  material: "glass" | "solid";
  isSettingOpen: boolean;
}

export const PRIMARY_PRESETS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

export const LAYOUT_STYLE_OPTIONS: { value: LayoutStyle; label: string }[] = [
  { value: "side", label: "侧栏" },
  { value: "top", label: "顶部" },
  { value: "mix", label: "混合" },
];

export const THEME_OPTIONS: { value: AppTheme; label: string; icon: string }[] = [
  { value: "light", label: "浅色", icon: "Sunny" },
  { value: "dark", label: "深色", icon: "Moon" },
  { value: "auto", label: "跟随系统", icon: "Monitor" },
];

export const PAGE_STYLE_OPTIONS: { value: SwitchPageStyle; label: string }[] = [
  { value: "zoom", label: "缩放淡入" },
  { value: "fadeIn", label: "纯淡入" },
  { value: "slide", label: "左右滑动" },
  { value: "rise", label: "底部上浮" },
  { value: "blur", label: "模糊聚焦" },
  { value: "3D", label: "3D 翻转" },
  { value: "flip", label: "翻页折叠" },
  { value: "reveal", label: "幕帘揭示" },
  { value: "none", label: "无动效" },
];

/** 动效值 → `<transition>` 的 name，none 表示不加任何过渡类 */
const PAGE_TRANSITION_NAMES: Record<SwitchPageStyle, string> = {
  zoom: "page-zoom",
  fadeIn: "page-fade",
  slide: "page-slide",
  rise: "page-rise",
  blur: "page-blur",
  "3D": "page-3d",
  flip: "page-flip",
  reveal: "page-reveal",
  none: "",
};

const fakeMenus: RouteRecordRaw[] = [
  {
    path: "/dashboard",
    name: "dashboard",
    redirect: "/dashboard",
    meta: { title: "仪表盘", icon: "Odometer", isScreen: true, target: true },
  },
  {
    path: "/system",
    name: "system",
    redirect: "/system/user",
    meta: { title: "系统管理", icon: "Setting" },
    children: [
      {
        path: "/system/user",
        name: "systemUser",
        redirect: "/system/user",
        meta: { title: "用户管理", icon: "User" },
      },
      {
        path: "https://element-plus.org",
        name: "external",
        redirect: "/dashboard",
        meta: { title: "外部链接", icon: "Link" },
      },
      {
        path: "/system/role",
        name: "systemRole",
        redirect: "/system/user",
        meta: { title: "角色管理", icon: "Avatar" },
      },
      {
        path: "/system/permission",
        name: "systemPermission",
        redirect: "/system/user",
        meta: { title: "权限管理", icon: "Lock" },
      },
      {
        path: "/system/setting",
        name: "systemSetting",
        redirect: "/system/setting",
        meta: { title: "系统设置", icon: "Tools" },
        children: [
          {
            path: "/system/setting/base",
            name: "systemSettingBase",
            redirect: "/system/setting",
            meta: { title: "基础配置", icon: "Operation" },
          },
          {
            path: "/system/setting/secure",
            name: "systemSettingSecure",
            redirect: "/system/setting",
            meta: { title: "安全策略", icon: "Key" },
          },
        ],
      },
    ],
  },
  {
    path: "/content",
    name: "content",
    redirect: "/dashboard",
    meta: { title: "内容管理", icon: "Document" },
    children: [
      {
        path: "/content/article",
        name: "contentArticle",
        redirect: "/dashboard",
        meta: { title: "文章管理", icon: "Notebook" },
      },
      {
        path: "/content/category",
        name: "contentCategory",
        redirect: "/dashboard",
        meta: { title: "分类管理", icon: "Files" },
      },
      {
        path: "/content/tag",
        name: "contentTag",
        redirect: "/dashboard",
        meta: { title: "标签管理", icon: "PriceTag" },
      },
    ],
  },
  {
    path: "/chart",
    name: "chart",
    redirect: "/dashboard",
    meta: { title: "数据可视化", icon: "DataLine" },
    children: [
      {
        path: "/chart/pie",
        name: "chartPie",
        redirect: "/dashboard",
        meta: { title: "饼图", icon: "PieChart" },
      },
      {
        path: "/chart/trend",
        name: "chartTrend",
        redirect: "/dashboard",
        meta: { title: "趋势分析", icon: "TrendCharts" },
      },
    ],
  },
  {
    path: "/monitor",
    name: "monitor",
    redirect: "/dashboard",
    meta: { title: "系统监控", icon: "Monitor" },
  },
  {
    path: "/log",
    name: "log",
    redirect: "/dashboard",
    meta: { title: "日志中心", icon: "Tickets" },
  },
  {
    path: "/component",
    name: "component",
    redirect: "/dashboard",
    meta: { title: "组件示例", icon: "Grid" },
  },
  {
    path: "https://element-plus.org",
    name: "external",
    redirect: "/dashboard",
    meta: { title: "外部链接", icon: "Link" },
  },
];

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  menuList: fakeMenus,
  isCollapse: false,
  theme: "light",
  layoutStyle: "side",
  switchPageStyle: "zoom",
  isShowBreadcrumbs: true,
  isShowTabs: true,
  isShowLogo: true,
  primaryColor: "#6366f1",
  sidebarTheme: "light",
  material: "glass",
  isSettingOpen: false,
};

const settings = reactive<LayoutSettings>({ ...DEFAULT_LAYOUT_SETTINGS });

const isMobile = useMediaQuery("(max-width: 992px)");
const prefersDark = usePreferredDark();

const isDark = computed(() => settings.theme === "dark" || (settings.theme === "auto" && prefersDark.value));

const transitionName = computed(() => PAGE_TRANSITION_NAMES[settings.switchPageStyle] ?? "");

const tabs = ref<AppTab[]>([
  { path: "/dashboard", fullPath: "/dashboard", name: "dashboard", title: "仪表盘" },
  { path: "/system/setting", fullPath: "/system/setting", name: "systemSetting", title: "系统设置" },
  { path: "/system/user", fullPath: "/system/user", name: "systemUser", title: "用户管理" },
  { path: "/system/user", fullPath: "/system/user?v=2", name: "systemUser", title: "角色管理" },
  { path: "/system/user", fullPath: "/system/user?v=3", name: "systemUser", title: "权限管理" },
  { path: "/dashboard", fullPath: "/dashboard?v=2", name: "dashboard", title: "数据看板" },
  { path: "/dashboard", fullPath: "/dashboard?v=3", name: "dashboard", title: "实时监控" },
  { path: "/dashboard", fullPath: "/dashboard?v=4", name: "dashboard", title: "运营报表" },
]);

const commandOpen = ref(false);

function visibleMenus(list?: RouteRecordRaw[]): RouteRecordRaw[] {
  return (list ?? []).filter((item) => !item.meta?.hidden);
}

function getActiveTop(path: string): RouteRecordRaw | undefined {
  return visibleMenus(settings.menuList).find((item) => (item.children?.length ? path === item.path || path.startsWith(`${item.path}/`) : path === item.path));
}

/** 当前路由所属一级模块的子菜单（混合布局下侧栏显示它） */
function getModuleMenus(path: string): RouteRecordRaw[] {
  return visibleMenus(getActiveTop(path)?.children);
}

function applyTheme() {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark.value);
  root.dataset.layout = settings.layoutStyle;
  root.dataset.material = settings.material;
  root.dataset.sidebar = settings.sidebarTheme;
  root.style.setProperty("--app-primary", settings.primaryColor);
}

const layout = reactive({
  ...toRefs(settings),
  userInfo: { name: "管理员", account: "admin" } as LayoutUserInfo,

  isMobile,
  isDark,
  transitionName,
  tabs,
  commandOpen,

  getActiveTop,
  getModuleMenus,
});

watch(() => [settings.theme, settings.primaryColor, settings.material, settings.sidebarTheme, settings.layoutStyle, isDark.value], applyTheme, { immediate: true });

watch(
  isMobile,
  (mobile) => {
    settings.isCollapse = mobile;
  },
  { immediate: true },
);

export default layout;
