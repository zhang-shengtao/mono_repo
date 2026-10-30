import type { RouteRecordRaw } from "@/router";
import { getStorage, setStorage, type JsonValue } from "@/utils/storage";

export type LayoutStyle = "side" | "top" | "mix";
export type SwitchPageStyle = "zoom" | "fadeIn" | "slide" | "rise" | "blur" | "3D" | "flip" | "reveal" | "none";
export type AppTheme = "light" | "dark" | "auto";

export interface LayoutUserInfo {
  name: string;
  account: string;
  avatar?: string;
}

export interface AppTab {
  /** 页签唯一标识：route.path（不含 query/hash，/user/1 这类参数已在 path 里） */
  path: string;
  name: string;
  title: string;
  /** 刷新版本：换掉它会让 <component> 的 key 变化，从而重建页面实例 */
  key: string;
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

/** 外观设置落盘用的 key。index.html 里的首屏脚本也读它，改名要同步改那边 */
export const LAYOUT_STORAGE_KEY = "admin:layout:settings";

/**
 * 需要记住的字段：主题、主题色、布局、材质这些「下次打开还得是它」的外观项。
 * 菜单树、页签、抽屉开合是运行时状态，刷新后按路由重新生成，不落盘。
 */
const PERSISTED_FIELDS = ["theme", "layoutStyle", "switchPageStyle", "isShowBreadcrumbs", "isShowTabs", "isShowLogo", "primaryColor", "sidebarTheme", "material"] as const;

type PersistedField = (typeof PERSISTED_FIELDS)[number];

/** 落盘的那部分设置（DEFAULT_LAYOUT_SETTINGS 的子集） */
type PersistedSettings = Pick<LayoutSettings, PersistedField>;

/** 缓存里的值不一定可信（手改、老版本、别的页面写坏），逐字段校验，脏数据按默认值处理 */
const PERSISTED_VALIDATORS: Record<PersistedField, (value: unknown) => boolean> = {
  theme: (value) => THEME_OPTIONS.some((item) => item.value === value),
  layoutStyle: (value) => LAYOUT_STYLE_OPTIONS.some((item) => item.value === value),
  switchPageStyle: (value) => PAGE_STYLE_OPTIONS.some((item) => item.value === value),
  isShowBreadcrumbs: (value) => typeof value === "boolean",
  isShowTabs: (value) => typeof value === "boolean",
  isShowLogo: (value) => typeof value === "boolean",
  primaryColor: (value) => typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value),
  sidebarTheme: (value) => value === "light" || value === "dark",
  material: (value) => value === "glass" || value === "solid",
};

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

/** 从本地缓存恢复外观设置：刷新、直接敲 /403 /404、进登录页时都还能接着用上次的主题 */
function restoreLayoutSettings(): Partial<LayoutSettings> {
  const cached = getStorage<JsonValue>(LAYOUT_STORAGE_KEY, {});
  const restored: Record<string, JsonValue> = {};

  // 缓存里可能是任何东西（手改、老版本、别的键写坏），不是普通对象就当没存过
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return restored;

  PERSISTED_FIELDS.forEach((field) => {
    const value = cached[field];
    if (PERSISTED_VALIDATORS[field](value)) restored[field] = value;
  });

  // 每个字段都过了 PERSISTED_VALIDATORS，这里把 Record 收回成带类型的设置对象
  return restored as PersistedSettings;
}

function saveLayoutSettings() {
  const cache: Record<string, string | boolean> = {};
  PERSISTED_FIELDS.forEach((field) => {
    cache[field] = settings[field];
  });
  setStorage(LAYOUT_STORAGE_KEY, cache);
}

const settings = reactive<LayoutSettings>({ ...DEFAULT_LAYOUT_SETTINGS, ...restoreLayoutSettings() });

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

/** 交给 <keep-alive :include> 的名字列表：include 只认组件名，path 用来跟着页签一起清理 */
const keepAlives = reactive<{ name: string; path: string }[]>([]);

const layout = reactive({
  ...toRefs(settings),
  userInfo: { name: "管理员", account: "admin" } as LayoutUserInfo,

  isMobile,
  isDark,
  transitionName,
  tabs,
  commandOpen,

  mainAppLadding: false,
  keepAlives,

  getActiveTop,
  getModuleMenus,
});

watch(() => [settings.theme, settings.primaryColor, settings.material, settings.sidebarTheme, settings.layoutStyle, isDark.value], applyTheme, { immediate: true });

watch(() => PERSISTED_FIELDS.map((field) => settings[field]), saveLayoutSettings);

watch(
  isMobile,
  (mobile) => {
    settings.isCollapse = mobile;
  },
  { immediate: true },
);

export default layout;
