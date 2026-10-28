<script setup lang="ts">
  /**
   * 多页签
   *
   * 状态读写全部走 @/layout（tabs / closeTab / closeOthers / closeAll），
   * 只在这里做跳转 —— 数据仓库不碰 router。
   */
  import { ElMessage } from "element-plus";
  import layout from "@/layout";
  import type { AppTab } from "@/layout";

  defineOptions({ name: "LayoutTabs" });

  const route = useRoute();
  const router = useRouter();

  const scrollRef = ref<HTMLElement>();

  const activePath = computed(() => route.fullPath);

  // ---- 右键菜单 ----
  const contextVisible = ref(false);
  const contextPos = reactive({ x: 0, y: 0 });
  const contextTab = ref<AppTab | null>(null);

  const contextActions = [
    { command: "refresh", label: "刷新当前页" },
    { command: "close", label: "关闭" },
    { command: "closeOthers", label: "关闭其他" },
    { command: "closeAll", label: "关闭全部" },
  ];

  function go(tab: AppTab) {
    if (tab.fullPath !== route.fullPath) router.push(tab.fullPath);
  }

  function close(tab: AppTab) {
    if (tab.affix) return;
    const wasActive = tab.fullPath === route.fullPath;
    const next = layout.closeTab(tab.fullPath);
    if (wasActive && next) router.push(next);
  }

  function openContextMenu(event: MouseEvent, tab: AppTab) {
    contextTab.value = tab;
    contextPos.x = event.clientX;
    contextPos.y = event.clientY;
    contextVisible.value = true;
  }

  function hideContextMenu() {
    contextVisible.value = false;
  }

  function onWheel(event: WheelEvent) {
    if (!scrollRef.value || event.deltaY === 0) return;
    scrollRef.value.scrollLeft += event.deltaY;
  }

  /**
   * 刷新：先让 keep-alive 丢掉这个页面的实例，再走 /redirect 中转回来，
   * 回来时是新实例重新进缓存 —— 页签保留，页面状态重置。
   */
  async function refresh(tab: AppTab | null) {
    if (!tab) return;
    layout.suspendCache(tab.name);
    await nextTick();
    await router.replace({ path: "/redirect", query: { to: tab.fullPath } });
    layout.resumeCache(tab.name);
  }

  async function onContextCommand(command: string) {
    const tab = contextTab.value;
    hideContextMenu();
    if (!tab) return;

    if (command === "refresh") {
      await refresh(tab);
      return;
    }
    if (command === "close") {
      close(tab);
      return;
    }
    if (command === "closeOthers") {
      layout.closeOthers(tab.fullPath);
      if (route.fullPath !== tab.fullPath) router.push(tab.fullPath);
      return;
    }
    if (command === "closeAll") {
      const next = layout.closeAll();
      if (next) router.push(next);
      ElMessage.success("已关闭全部页签");
    }
  }

  // 当前页签滚进可视区
  watch(
    activePath,
    async () => {
      await nextTick();
      const el = scrollRef.value?.querySelector<HTMLElement>('[data-active="true"]');
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    { immediate: true },
  );

  useEventListener(window, "click", hideContextMenu);
</script>

<template>
  <div class="relative flex h-[var(--app-tabs-h)] items-center border-t border-glass-border px-2">
    <div ref="scrollRef" class="app-scroll-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1" @wheel.prevent="onWheel">
      <div
        v-for="tab in layout.tabs"
        :key="tab.fullPath"
        :data-active="tab.fullPath === activePath"
        class="tab-item group flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[999px] border border-transparent px-3 py-[3px] text-[12.5px] transition-all duration-200"
        :class="
          tab.fullPath === activePath
            ? 'border-[color-mix(in_srgb,var(--app-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-primary)_12%,transparent)] font-medium text-primary'
            : 'text-ink-2 hover:bg-[color-mix(in_srgb,var(--app-primary)_7%,transparent)] hover:text-ink'
        "
        @click="go(tab)"
        @contextmenu.prevent.stop="openContextMenu($event, tab)"
      >
        <span v-if="tab.affix" class="size-1.5 shrink-0 rounded-full bg-primary" />
        <span class="max-w-[140px] truncate">{{ tab.title }}</span>
        <span
          v-if="!tab.affix"
          class="tab-close grid size-4 shrink-0 place-items-center rounded-full text-[13px] leading-none opacity-0 transition-opacity group-hover:opacity-100"
          :class="{ 'opacity-100': tab.fullPath === activePath }"
          @click.stop="close(tab)"
        >
          ×
        </span>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextVisible"
      class="app-card fixed z-[3000] w-[136px] overflow-hidden p-1 text-[13px]"
      :style="{ left: `${contextPos.x}px`, top: `${contextPos.y}px` }"
      @click.stop
    >
      <button
        v-for="action in contextActions"
        :key="action.command"
        type="button"
        class="block w-full cursor-pointer rounded-[8px] border-0 bg-transparent px-2.5 py-1.5 text-left text-ink-2 transition-colors hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)] hover:text-primary"
        @click="onContextCommand(action.command)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .tab-item:hover .tab-close {
    background-color: color-mix(in srgb, var(--app-text-3) 18%, transparent);
  }
</style>
