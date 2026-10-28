<script setup lang="ts">
  /**
   * 顶栏容器
   *
   * Logo 由壳通过 #logo slot 注入（不 import../setting/Logo.vue，守子目录规则）。
   */
  import Left from "./Left.vue";
  import Right from "./Right.vue";
  import Tabs from "./Tabs.vue";
  import Top from "./Top.vue";
  import layout from "@/layout";

  defineOptions({ name: "LayoutHeader" });

  /** side / mix 布局的 Logo 在侧栏；只有 top 布局才放进顶栏 */
  const showLogo = computed(() => layout.settings.isShowLogo && layout.settings.layoutStyle === "top");

  /** top 与 mix 都要一行一级横向导航 */
  const showTopMenu = computed(
    () => layout.settings.layoutStyle === "top" || layout.settings.layoutStyle === "mix",
  );
</script>

<template>
  <header class="shrink-0">
    <div
      class="flex h-[var(--app-header-h)] items-center gap-3 border-b border-glass-border px-3.5 backdrop-blur-[18px] backdrop-saturate-150"
      :style="{ backgroundColor: 'var(--app-header)' }"
    >
      <div v-if="showLogo" class="shrink-0">
        <slot name="logo" />
      </div>

      <Left />

      <Top v-if="showTopMenu" />
      <div v-else class="min-w-0 flex-1" />

      <Right />
    </div>

    <Tabs v-if="layout.settings.isShowTabs" />
  </header>
</template>
