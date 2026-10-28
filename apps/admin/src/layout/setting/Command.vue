<script setup lang="ts">
  /**
   * Ctrl / ⌘ + K 命令面板
   *
   * 数据来源：
   *   页面项 ← @/layout 的 flatMenus
   *   操作项 ← 本文件内的动作表（调 @/layout 的动作）
   */
  import { ElMessage } from "element-plus";
  import layout from "@/layout";

  defineOptions({ name: "LayoutCommand" });

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
  const listRef = ref<HTMLElement>();

  const actionItems: CommandItem[] = [
    {
      key: "action-theme",
      title: "切换明暗主题",
      group: "操作",
      icon: "Moon",
      run: () => layout.toggleTheme(),
    },
    {
      key: "action-material",
      title: "切换材质（玻璃 / 纯色）",
      group: "操作",
      icon: "MagicStick",
      run: () => layout.toggleMaterial(),
    },
    {
      key: "action-collapse",
      title: "折叠 / 展开侧栏",
      group: "操作",
      icon: "Fold",
      run: () => layout.toggleCollapse(),
    },
    {
      key: "action-layout-side",
      title: "布局：侧栏",
      group: "操作",
      icon: "Grid",
      run: () => {
        layout.settings.layoutStyle = "side";
      },
    },
    {
      key: "action-layout-top",
      title: "布局：顶部",
      group: "操作",
      icon: "Grid",
      run: () => {
        layout.settings.layoutStyle = "top";
      },
    },
    {
      key: "action-layout-mix",
      title: "布局：混合",
      group: "操作",
      icon: "Grid",
      run: () => {
        layout.settings.layoutStyle = "mix";
      },
    },
    {
      key: "action-setting",
      title: "打开外观设置",
      group: "操作",
      icon: "Setting",
      run: () => layout.openSetting(),
    },
    {
      key: "action-reset",
      title: "恢复默认布局",
      group: "操作",
      icon: "RefreshLeft",
      run: () => {
        layout.resetLayout();
        ElMessage.success("已恢复默认布局");
      },
    },
  ];

  const pageItems = computed<CommandItem[]>(() =>
    layout.flatMenus.map((menu) => ({
      key: `page:${menu.path}`,
      title: menu.meta.title,
      group: "页面" as const,
      icon: menu.meta.icon,
      run: () => router.push(menu.path),
    })),
  );

  const filtered = computed<CommandItem[]>(() => {
    const key = keyword.value.trim().toLowerCase();
    const all = [...pageItems.value, ...actionItems];
    if (!key) return all;
    return all.filter((item) => item.title.toLowerCase().includes(key) || item.key.includes(key));
  });

  const grouped = computed(() => [
    { name: "页面", items: filtered.value.filter((item) => item.group === "页面") },
    { name: "操作", items: filtered.value.filter((item) => item.group === "操作") },
  ]);

  /** 扁平顺序（键盘导航用） */
  const flatFiltered = computed<CommandItem[]>(() => grouped.value.flatMap((group) => group.items));

  watch(filtered, () => {
    activeIndex.value = 0;
  });

  // 打开时重置并聚焦
  watch(
    () => layout.isCommandOpen,
    async (open) => {
      if (!open) return;
      keyword.value = "";
      activeIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    },
  );

  watch(activeIndex, async () => {
    await nextTick();
    listRef.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  });

  function run(item?: CommandItem) {
    const target = item ?? flatFiltered.value[activeIndex.value];
    if (!target) return;
    layout.closeCommand();
    target.run();
  }

  function move(step: number) {
    const total = flatFiltered.value.length;
    if (!total) return;
    activeIndex.value = (activeIndex.value + step + total) % total;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      layout.closeCommand();
    }
  }

  // 全局快捷键：Ctrl/⌘ + K（浏览器默认会聚焦地址栏，必须 preventDefault）
  useEventListener(
    window,
    "keydown",
    (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (layout.isCommandOpen) layout.closeCommand();
      else layout.openCommand();
    },
    { capture: true },
  );
</script>

<template>
  <teleport to="body">
    <transition name="page-fade">
      <div
        v-if="layout.isCommandOpen"
        class="fixed inset-0 z-[4000] flex items-start justify-center bg-[rgba(15,23,42,.35)] pt-[12vh] backdrop-blur-[4px]"
        @click.self="layout.closeCommand()"
      >
        <div class="app-card w-[min(560px,calc(100vw-32px))] overflow-hidden p-0">
          <div class="flex items-center gap-2 border-b border-glass-border px-4 py-3">
            <MyIcon name="Search" :size="17" color="var(--app-text-3)" />
            <input
              ref="inputRef"
              v-model="keyword"
              type="text"
              placeholder="搜索页面或操作…"
              class="w-full border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
              @keydown="onKeydown"
            />
            <kbd class="shrink-0 rounded-[6px] border border-glass-border px-1.5 py-0.5 text-[11px] text-ink-3">ESC</kbd>
          </div>

          <div ref="listRef" class="app-scroll max-h-[46vh] overflow-y-auto px-2 py-2">
            <template v-for="group in grouped" :key="group.name">
              <div v-if="group.items.length" class="px-2 pb-1 pt-2 text-[11px] font-medium tracking-wide text-ink-3">
                {{ group.name }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                :data-active="flatFiltered[activeIndex]?.key === item.key"
                class="flex w-full cursor-pointer items-center gap-2.5 rounded-inner border-0 bg-transparent px-2.5 py-2 text-left text-[13.5px] transition-colors"
                :class="
                  flatFiltered[activeIndex]?.key === item.key
                    ? 'bg-[color-mix(in_srgb,var(--app-primary)_12%,transparent)] text-primary'
                    : 'text-ink-2 hover:bg-[color-mix(in_srgb,var(--app-primary)_7%,transparent)]'
                "
                @mouseenter="activeIndex = flatFiltered.findIndex((entry) => entry.key === item.key)"
                @click="run(item)"
              >
                <MyIcon v-if="item.icon" :name="item.icon" :size="16" />
                <span class="flex-1 truncate">{{ item.title }}</span>
              </button>
            </template>

            <div v-if="!flatFiltered.length" class="px-2 py-8 text-center text-[13px] text-ink-3">没有匹配结果</div>
          </div>

          <div class="flex items-center gap-4 border-t border-glass-border px-4 py-2 text-[11px] text-ink-3">
            <span>↑↓ 选择</span>
            <span>↵ 执行</span>
            <span>ESC 关闭</span>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>
