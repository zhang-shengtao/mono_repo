/** 界面外壳状态：侧边栏折叠（本地记忆） */
import { ref } from "vue";
import { defineStore } from "pinia";

const COLLAPSE_KEY = "repo:admin:aside-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export const useAppStore = defineStore("app", () => {
  const collapsed = ref(readCollapsed());

  function toggleCollapsed(): void {
    collapsed.value = !collapsed.value;
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed.value ? "1" : "0");
    } catch {
      // 忽略：折叠状态记不住不影响使用
    }
  }

  return { collapsed, toggleCollapsed };
});
