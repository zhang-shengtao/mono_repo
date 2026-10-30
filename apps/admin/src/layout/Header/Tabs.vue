<script setup lang="ts">
  defineOptions({ name: "LayoutTabs" });

  import layoutData, { type AppTab } from "@/layout";
  import { randomString } from "@/utils/method";
  const route = useRoute();
  const router = useRouter();

  const scrollRef = ref<HTMLElement>();
  const canLeft = ref(false);
  const canRight = ref(false);

  // 页签身份统一用 route.path（不含 query/hash）
  function isActive(tab: AppTab) {
    return tab.path === route.path;
  }

  function tabIndex(path: string) {
    return layoutData.tabs.findIndex((item) => item.path === path);
  }

  function updateScrollState() {
    const el = scrollRef.value;
    if (!el) return;
    canLeft.value = el.scrollLeft > 2;
    canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
  }

  function go(tab: AppTab) {
    if (!isActive(tab)) router.push(tab.path);
  }

  function onWheel(event: WheelEvent) {
    if (!scrollRef.value || event.deltaY === 0) return;
    scrollRef.value.scrollLeft += event.deltaY;
  }

  function scrollStep(direction: number) {
    scrollRef.value?.scrollBy({ left: direction * 220, behavior: "smooth" });
  }

  function ensureActive(tab: AppTab) {
    const stillExists = layoutData.tabs.some((item) => item.path === route.path);
    if (!stillExists) router.push(tab.path);
  }

  let refreshTime: ReturnType<typeof setTimeout> | undefined;

  async function refresh(tab: AppTab) {
    if (refreshTime) clearTimeout(refreshTime);
    layoutData.mainAppLadding = true;
    const entry = layoutData.keepAlives.find((item) => item.path === tab.path) ?? layoutData.keepAlives.find((item) => item.name === tab.name);
    const index = entry ? layoutData.keepAlives.indexOf(entry) : -1;
    if (index >= 0) layoutData.keepAlives.splice(index, 1);
    await nextTick();
    tab.key = randomString();
    await nextTick();
    if (entry && !layoutData.keepAlives.some((item) => item.name === entry.name)) {
      layoutData.keepAlives.push({ name: entry.name, path: tab.path });
    }
    refreshTime = setTimeout(() => (layoutData.mainAppLadding = false), 300);
  }

  async function copyPath(tab: AppTab) {
    const url = `${window.location.origin}${tab.path}`;
    try {
      await navigator.clipboard.writeText(url);
      ElMessage.success("已复制页面路径");
    } catch {
      ElMessage.warning(url);
    }
  }

  async function onCommand(command: string | number | object, tab: AppTab) {
    switch (command) {
      case "refresh":
        await refresh(tab);
        break;
      case "close": {
        const index = tabIndex(tab.path);
        if (index < 0) break;

        const wasActive = isActive(tab);
        layoutData.tabs.splice(index, 1);
        // 关掉当前页签时优先切到右边那个，没有就往左退一格
        const next = layoutData.tabs[index] ?? layoutData.tabs[index - 1];
        if (wasActive && next) router.push(next.path);
        break;
      }
      case "closeOthers":
        layoutData.tabs = layoutData.tabs.filter((item) => item.path === tab.path);
        if (!isActive(tab)) router.push(tab.path);
        break;
      case "closeLeft": {
        const index = tabIndex(tab.path);
        if (index > 0) layoutData.tabs.splice(0, index);
        ensureActive(tab);
        break;
      }
      case "closeRight": {
        const index = tabIndex(tab.path);
        if (index >= 0) layoutData.tabs.splice(index + 1);
        ensureActive(tab);
        break;
      }
      case "closeAll": {
        const first = layoutData.tabs[0];
        // 关全部后回到第一个页签；当前就在第一个页签时 router.push 同地址是重复导航、页签不会重建，
        // 所以直接把它留下，避免页签栏空掉
        layoutData.tabs = first && first.path === route.path ? [first] : [];
        if (first && first.path !== route.path) router.push(first.path);
        break;
      }
      case "copy":
        await copyPath(tab);
        break;
    }
    await nextTick();
    updateScrollState();
  }

  watch(
    () => route.path,
    async () => {
      await nextTick();
      scrollRef.value?.querySelector<HTMLElement>(".tab.is-active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
      updateScrollState();
    },
    { immediate: true },
  );

  watch(
    () => layoutData.tabs.length,
    async () => {
      await nextTick();
      updateScrollState();
    },
  );

  onMounted(updateScrollState);
  onUnmounted(() => {
    if (!!refreshTime) clearTimeout(refreshTime);
  });
  useEventListener(window, "resize", updateScrollState);
</script>

<template>
  <div class="tabs">
    <button v-if="canLeft" type="button" class="app-icon-btn is-sm tabs-arrow" title="向左滚动" @click="scrollStep(-1)">
      <my-icon name="ArrowLeft" :size="13" />
    </button>

    <div ref="scrollRef" class="tabs-scroll app-scroll-none" @wheel.prevent="onWheel" @scroll="updateScrollState">
      <div v-for="tab in layoutData.tabs" :key="tab.path" class="tab" :class="{ 'is-active': isActive(tab) }" :title="tab.title" @click="go(tab)">
        <span class="tab-title">{{ tab.title }}</span>

        <el-dropdown trigger="hover" placement="bottom-end" :show-timeout="80" :hide-timeout="80" @command="onCommand($event, tab)">
          <span class="tab-action" title="更多操作" @click.stop>
            <my-icon name="ArrowDown" :size="11" />
          </span>

          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="refresh" :disabled="!isActive(tab) || layoutData.mainAppLadding">刷新页面</el-dropdown-item>
              <el-dropdown-item command="close">关闭当前</el-dropdown-item>
              <el-dropdown-item command="closeOthers">关闭其他</el-dropdown-item>
              <el-dropdown-item command="closeLeft" divided>关闭左侧</el-dropdown-item>
              <el-dropdown-item command="closeRight">关闭右侧</el-dropdown-item>
              <el-dropdown-item command="closeAll">关闭全部</el-dropdown-item>
              <el-dropdown-item command="copy" divided>复制页面路径</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <button v-if="canRight" type="button" class="app-icon-btn is-sm tabs-arrow" title="向右滚动" @click="scrollStep(1)">
      <my-icon name="ArrowRight" :size="13" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
  .tabs {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 4px;
    height: var(--app-tabs-h);
    padding: 0 10px;
    border-top: 1px solid var(--app-glass-border);
    background-color: color-mix(in srgb, var(--app-primary) 5%, transparent);
  }

  .tabs .tabs-arrow {
    width: 20px;
    height: 20px;
    border-radius: 6px;
  }

  .tabs-scroll {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tab {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 3px;
    height: 22px;
    max-width: 148px;
    padding: 0 5px 0 7px;
    border: 1px solid transparent;
    border-radius: 6px;
    background-color: transparent;
    color: var(--app-text-2);
    font-size: 12px;
    cursor: pointer;
    transition:
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease),
      border-color var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease);

    &:hover {
      color: var(--app-text);
      background-color: color-mix(in srgb, var(--app-primary) 7%, transparent);
    }

    &.is-active {
      color: var(--app-primary);
      font-weight: 600;
      border-color: color-mix(in srgb, var(--app-primary) 26%, transparent);
      background-color: var(--app-surface);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--app-primary) 16%, transparent);
    }
  }

  .tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab :deep(.el-dropdown) {
    display: inline-flex;
    align-items: center;
  }

  .tab-action {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    color: var(--app-text-3);
    opacity: 0;
    transition:
      opacity var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease);

    &:hover {
      color: var(--app-primary);
      background-color: color-mix(in srgb, var(--app-primary) 14%, transparent);
    }

    .tab:hover &,
    .tab.is-active & {
      opacity: 1;
    }
  }
</style>
