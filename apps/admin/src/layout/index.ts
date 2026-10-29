import type { RouteRecordRaw } from "@/router";

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

export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  menuList: [],
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

const tabs = ref<AppTab[]>([]);

const commandOpen = ref(false);

function getActiveTop(path: string): RouteRecordRaw | undefined {
  return settings.menuList.find((item) => (item.children?.length ? path === item.path || path.startsWith(`${item.path}/`) : path === item.path));
}

function getModuleMenus(path: string): RouteRecordRaw[] {
  return getActiveTop(path)?.children ?? [];
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
