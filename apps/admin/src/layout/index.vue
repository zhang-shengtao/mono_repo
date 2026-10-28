<script setup lang="ts">
  /**
   * 布局壳：唯一允许跨子目录编排的组件
   *
   * side : 侧栏 + 顶栏 + 内容
   * top  : 顶栏（含一级横向菜单）+ 内容
   * mix  : 顶栏（一级横向菜单）+ 侧栏（当前一级的子菜单）+ 内容
   * ≤992px：侧栏统一收进抽屉
   *
   * Logo 通过 #logo slot 注入 Menu / Header，子目录之间不互相 import。
   */
  import Header from "./Header/index.vue";
  import MainApp from "./MainApp/index.vue";
  import Menu from "./Menu/index.vue";
  import Logo from "./setting/Logo.vue";
  import SettingPanel from "./setting/index.vue";
  import Command from "./setting/Command.vue";
  import layout from "@/layout";

  defineOptions({ name: "Layout" });

  const route = useRoute();

  const showSide = computed(
    () => !layout.isMobile && (layout.settings.layoutStyle === "side" || layout.settings.layoutStyle === "mix"),
  );

  const asideWidth = computed(() =>
    layout.settings.isCollapse ? "var(--app-sidebar-w-collapsed)" : "var(--app-sidebar-w)",
  );

  // 壳的副作用：路由变化 → 同步页签 + 收起移动端抽屉（不属于数据仓库的职责）
  watch(
    () => route.fullPath,
    () => {
      layout.closeMobileMenu();
      layout.ensureAffixTabs();

      const name = String(route.name ?? "");
      const title = route.meta?.title;
      if (!name || !title || route.meta?.hidden) return;

      layout.addTab({
        path: route.path,
        fullPath: route.fullPath,
        name,
        title: String(title),
        affix: route.meta.affix === true,
        keepAlive: route.meta.keepAlive !== false,
      });
    },
    { immediate: true },
  );
</script>

<template>
  <div class="relative flex h-full w-full overflow-hidden">
    <!-- L0 光斑背景 -->
    <div class="app-aurora" aria-hidden="true" />

    <!-- 侧栏 -->
    <aside
      v-if="showSide"
      class="relative z-10 shrink-0 border-r border-glass-border backdrop-blur-[18px] backdrop-saturate-150 transition-[width] duration-200"
      :style="{ width: asideWidth, backgroundColor: 'var(--app-sidebar)' }"
    >
      <Menu>
        <template #logo>
          <Logo :collapsed="layout.settings.isCollapse" />
        </template>
      </Menu>
    </aside>

    <!-- 主区 -->
    <div class="relative z-10 flex min-w-0 flex-1 flex-col">
      <Header>
        <template #logo>
          <Logo standalone />
        </template>
      </Header>
      <MainApp />
    </div>

    <!-- 移动端侧栏抽屉 -->
    <el-drawer
      v-model="layout.mobileMenuOpen"
      class="app-mobile-drawer"
      direction="ltr"
      size="232px"
      :with-header="false"
    >
      <Menu mobile>
        <template #logo>
          <Logo />
        </template>
      </Menu>
    </el-drawer>

    <!-- 设置抽屉 + 命令面板（各渲染一次） -->
    <SettingPanel />
    <Command />
  </div>
</template>
