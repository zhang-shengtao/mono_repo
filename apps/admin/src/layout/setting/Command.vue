<script setup lang="ts">
  defineOptions({ name: "LayoutCommand" });

  import layoutData from "@/layout";
  import type { RouteRecordRaw } from "vue-router";

  const router = useRouter();

  interface CommandItem {
    key: string;
    title: string;
    group: "页面" | "操作";
    icon?: string;
    run: () => void;
  }

  const keyword = ref("");
  const activeIndex = ref(0);
  const inputRef = ref<HTMLInputElement>();

  // menuList 已在 pinia/user.ts 的 menuArr 里递归剔除 hidden，这里只做拍平
  function flattenMenus(list: RouteRecordRaw[], out: RouteRecordRaw[] = []): RouteRecordRaw[] {
    for (const item of list) {
      if (item.children?.length) flattenMenus(item.children, out);
      else out.push(item);
    }
    return out;
  }

  const pageItems = computed<CommandItem[]>(() =>
    flattenMenus(layoutData.menuList).map((item) => ({
      key: `page:${item.path}`,
      title: String(item.meta?.title ?? item.path),
      group: "页面" as const,
      icon: item.meta?.icon,
      run: () => {
        if (item.path.startsWith("http")) window.open(item.path, "_blank", "noopener");
        else router.push(item.path);
      },
    })),
  );

  const actionItems: CommandItem[] = [
    {
      key: "act-theme",
      title: "切换明暗主题",
      group: "操作",
      icon: "Moon",
      run: () => {
        layoutData.theme = layoutData.isDark ? "light" : "dark";
      },
    },
    {
      key: "act-material",
      title: "切换材质（玻璃 / 纯色）",
      group: "操作",
      icon: "MagicStick",
      run: () => {
        layoutData.material = layoutData.material === "glass" ? "solid" : "glass";
      },
    },
    {
      key: "act-collapse",
      title: "收起 / 展开侧栏",
      group: "操作",
      icon: "Fold",
      run: () => {
        layoutData.isCollapse = !layoutData.isCollapse;
      },
    },
    {
      key: "act-setting",
      title: "打开外观设置",
      group: "操作",
      icon: "Setting",
      run: () => {
        layoutData.isSettingOpen = true;
      },
    },
    {
      key: "act-layout-side",
      title: "布局：侧栏",
      group: "操作",
      icon: "Grid",
      run: () => {
        layoutData.layoutStyle = "side";
      },
    },
    {
      key: "act-layout-top",
      title: "布局：顶部",
      group: "操作",
      icon: "Grid",
      run: () => {
        layoutData.layoutStyle = "top";
      },
    },
    {
      key: "act-layout-mix",
      title: "布局：混合",
      group: "操作",
      icon: "Grid",
      run: () => {
        layoutData.layoutStyle = "mix";
      },
    },
  ];

  const result = computed<CommandItem[]>(() => {
    const all = [...actionItems, ...pageItems.value];
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) return all;
    return all.filter((item) => item.title.toLowerCase().includes(kw));
  });

  watch(result, () => {
    activeIndex.value = 0;
  });

  watch(
    () => layoutData.commandOpen,
    async (open) => {
      if (!open) return;
      keyword.value = "";
      activeIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    },
  );

  function run(item?: CommandItem) {
    const target = item ?? result.value[activeIndex.value];
    if (!target) return;
    layoutData.commandOpen = false;
    target.run();
  }

  function move(step: number) {
    const total = result.value.length;
    if (!total) return;
    activeIndex.value = (activeIndex.value + step + total) % total;
  }

  function onKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      layoutData.commandOpen = !layoutData.commandOpen;
      return;
    }

    if (!layoutData.commandOpen) return;

    if (key === "escape") {
      layoutData.commandOpen = false;
    } else if (key === "arrowdown") {
      event.preventDefault();
      move(1);
    } else if (key === "arrowup") {
      event.preventDefault();
      move(-1);
    } else if (key === "enter") {
      event.preventDefault();
      run();
    }
  }

  useEventListener(document, "keydown", onKeydown);
</script>

<template>
  <teleport to="body">
    <div v-if="layoutData.commandOpen" class="app-command-mask" @click.self="layoutData.commandOpen = false">
      <div class="app-command-panel">
        <div class="command-search">
          <MyIcon name="Search" :size="16" color="var(--app-text-3)" />
          <input ref="inputRef" v-model="keyword" class="command-input" placeholder="搜索页面或操作…" />
          <kbd class="command-kbd">ESC</kbd>
        </div>

        <div class="command-list app-scroll">
          <button
            v-for="(item, index) in result"
            :key="item.key"
            type="button"
            class="command-item"
            :class="{ 'is-active': index === activeIndex }"
            @mouseenter="activeIndex = index"
            @click="run(item)"
          >
            <MyIcon v-if="item.icon" :name="item.icon" :size="16" />
            <span class="command-title">{{ item.title }}</span>
            <span class="command-group">{{ item.group }}</span>
          </button>

          <p v-if="!result.length" class="command-empty">没有匹配的结果</p>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style lang="scss" scoped>
  .command-search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--app-glass-border);
  }

  .command-input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--app-text);
    font-family: inherit;
    font-size: 14px;

    &::placeholder {
      color: var(--app-text-3);
    }
  }

  .command-kbd {
    padding: 1px 6px;
    border: 1px solid color-mix(in srgb, var(--app-text-3) 26%, transparent);
    border-radius: 6px;
    color: var(--app-text-3);
    font-family: inherit;
    font-size: 10px;
    line-height: 16px;
  }

  .command-list {
    max-height: 46vh;
    padding: 6px;
    overflow-y: auto;
  }

  .command-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: var(--app-radius-sm);
    background: transparent;
    color: var(--app-text-2);
    font-family: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease),
      transform var(--app-dur) var(--app-ease);

    &.is-active {
      color: var(--app-primary);
      background-color: color-mix(in srgb, var(--app-primary) 10%, transparent);
      transform: translateX(2px);
    }
  }

  .command-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-group {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--app-text-3);
  }

  .command-empty {
    margin: 0;
    padding: 22px 0;
    color: var(--app-text-3);
    font-size: 13px;
    text-align: center;
  }
</style>
