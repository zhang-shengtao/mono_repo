import type { AdminProfile } from "@repo/shared";
import type { AppMenuNode } from "@/router/dynamic";
import { getStorage, setStorage, type JsonValue } from "@/utils/storage";

export type LayoutStyle = "side" | "top" | "mix";
export type SwitchPageStyle = "zoom" | "fadeIn" | "slide" | "rise" | "blur" | "3D" | "flip" | "reveal" | "none";
export type AppTheme = "light" | "dark" | "auto";

export interface AppTab {
  path: string;
  name: string;
  title: string;

  key: string;
}

export interface LayoutSettings {
  menuList: AppMenuNode[];
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

export const LAYOUT_STORAGE_KEY = "admin:layout:settings";

const PERSISTED_FIELDS = ["theme", "layoutStyle", "switchPageStyle", "isShowBreadcrumbs", "isShowTabs", "isShowLogo", "primaryColor", "sidebarTheme", "material"] as const;

type PersistedField = (typeof PERSISTED_FIELDS)[number];

type PersistedSettings = Pick<LayoutSettings, PersistedField>;

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

function restoreLayoutSettings(): Partial<LayoutSettings> {
  const cached = getStorage<JsonValue>(LAYOUT_STORAGE_KEY, {});
  const restored: Record<string, JsonValue> = {};

  if (!cached || typeof cached !== "object" || Array.isArray(cached)) return restored;

  PERSISTED_FIELDS.forEach((field) => {
    const value = cached[field];
    if (PERSISTED_VALIDATORS[field](value)) restored[field] = value;
  });

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

const isMobile: boolean = useMediaQuery("(max-width: 992px)");
const prefersDark = usePreferredDark();

const isDark = computed(() => settings.theme === "dark" || (settings.theme === "auto" && prefersDark.value));

const transitionName = computed(() => PAGE_TRANSITION_NAMES[settings.switchPageStyle] ?? "");

const tabs = ref<AppTab[]>([]);

const commandOpen = ref(false);

function getActiveTop(path: string): AppMenuNode | undefined {
  return settings.menuList.find((item) => (item.children?.length ? path === item.path || path.startsWith(`${item.path}/`) : path === item.path));
}

function getModuleMenus(path: string): AppMenuNode[] {
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

const keepAlives = reactive<{ name: string; path: string }[]>([]);

const layout = reactive({
  ...toRefs(settings),

  userInfo: { user_id: 0, parent_id: 0, account: "", nickname: "管理员", status: "normal" } as AdminProfile,

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
