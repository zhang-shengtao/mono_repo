<script setup lang="ts">
  defineOptions({ name: "Layout" });
  import { userPinia } from "@/pinia";
  import Header from "./Header/index.vue";
  import MainApp from "./MainApp/index.vue";
  import Menu from "./Menu/index.vue";
  import Command from "./setting/Command.vue";
  import SettingPanel from "./setting/index.vue";
  import layoutData from "@/layout";
  const userStore = userPinia();
  layoutData.userInfo = userStore.userInfo;
  layoutData.menuList = userStore.menuList;
  const route = useRoute();

  function collectTab() {
    if (!layoutData.isShowTabs) {
      if (layoutData.tabs.length) layoutData.tabs = [];
      return;
    }
    const title = route.meta?.title;
    if (!title || !route.name || route.meta?.hidden) return;
    const tab = { path: route.path, name: String(route.name), title: String(title), key: "" };
    const exist = layoutData.tabs.find((item) => item.path === tab.path);
    if (exist) exist.title = tab.title;
    else layoutData.tabs.push(tab);
  }

  // 页签按 route.path 建：query / hash 变化不算换页，不需要新页签
  watch(
    () => route.path,
    () => {
      if (layoutData.isMobile) layoutData.isCollapse = true;
      collectTab();
    },
    { immediate: true },
  );

  // 开关不会触发路由变化，单独盯一下：关掉时清空历史页签，重新打开时补回当前页签
  watch(() => layoutData.isShowTabs, collectTab);
  const isMixChildless = computed(() => layoutData.layoutStyle === "mix" && !layoutData.isMobile && layoutData.getModuleMenus(route.path).length === 0);
  const rootClass = computed(() => ({
    "is-collapse": layoutData.isCollapse,
    "is-mobile": layoutData.isMobile,
    "is-no-tabs": !layoutData.isShowTabs,
    "is-no-side": isMixChildless.value,
  }));
  const watermark = ref("");
</script>

<template>
  <el-watermark :content="watermark">
    <div class="layout" :class="rootClass" :data-layout="layoutData.layoutStyle">
      <div class="layout-aurora" aria-hidden="true"></div>
      <aside class="layout-side">
        <Menu />
      </aside>
      <header class="layout-head">
        <Header />
      </header>
      <main class="layout-main">
        <MainApp />
      </main>
      <div class="layout-mask" @click="layoutData.isCollapse = true"></div>
      <SettingPanel />
      <Command />
    </div>
  </el-watermark>
</template>

<style lang="scss" scoped>
  .layout {
    --side-w: var(--app-side-w);
    --tabs-h: var(--app-tabs-h);
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    isolation: isolate;
    background-color: var(--app-bg);
    &.is-collapse {
      --side-w: var(--app-side-w-collapsed);
    }
    &.is-no-tabs {
      --tabs-h: 0px;
    }
    &[data-layout="top"] {
      --side-w: 0px;
    }
    &.is-no-side {
      --side-w: 0px;
    }
    &.is-mobile {
      --side-w: 0px;
    }
  }
  .layout-aurora {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background-color: var(--app-bg);
    background-image: radial-gradient(circle at 82% 18%, var(--app-aurora-3), transparent 55%);
    &::before,
    &::after {
      content: "";
      position: absolute;
      width: 62vw;
      height: 62vw;
      border-radius: 50%;
      will-change: transform;
    }
    &::before {
      top: -24vw;
      left: -14vw;
      background: radial-gradient(circle at center, var(--app-aurora-1), transparent 68%);
      animation: aurora-a 16s var(--app-ease) infinite alternate;
    }
    &::after {
      right: -20vw;
      bottom: -26vw;
      background: radial-gradient(circle at center, var(--app-aurora-2), transparent 68%);
      animation: aurora-b 20s var(--app-ease) infinite alternate;
    }
  }
  @keyframes aurora-a {
    from {
      transform: translate3d(0, 0, 0) scale(1);
    }
    to {
      transform: translate3d(6vw, 4vw, 0) scale(1.12);
    }
  }
  @keyframes aurora-b {
    from {
      transform: translate3d(0, 0, 0) scale(1.06);
    }
    to {
      transform: translate3d(-5vw, -5vw, 0) scale(1);
    }
  }
  .layout-side {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 30;
    width: var(--side-w);
    overflow: hidden;
    background-color: var(--app-sidebar);
    background-image: var(--app-sidebar-image, none);
    box-shadow: var(--app-sidebar-shadow, none);
    backdrop-filter: var(--app-sidebar-blur);
    -webkit-backdrop-filter: var(--app-sidebar-blur);
    transition:
      width 300ms var(--app-ease),
      transform 340ms var(--app-ease),
      opacity 300ms var(--app-ease);
    will-change: width, transform;
  }
  .layout-side::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      var(--app-sidebar-border) 0%,
      color-mix(in srgb, var(--app-sidebar-border) 46%, transparent) 26%,
      color-mix(in srgb, var(--app-sidebar-border) 18%, transparent) 64%,
      color-mix(in srgb, var(--app-sidebar-border) 40%, transparent) 100%
    );
  }
  .layout-side::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-image: var(--app-sidebar-glow, none);
    background-repeat: no-repeat;
    opacity: 0.62;
    animation: sidebar-glow-drift 26s var(--app-ease) infinite alternate;
    will-change: transform;
  }
  @keyframes sidebar-glow-drift {
    from {
      transform: translate3d(-3%, -2%, 0) scale(1.02);
    }
    to {
      transform: translate3d(7%, 6%, 0) scale(1.18);
    }
  }
  .layout[data-layout="top"] .layout-side {
    width: var(--app-side-w);
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
  }
  .layout-head {
    position: absolute;
    top: 0;
    right: 0;
    left: var(--side-w);
    z-index: 20;
    height: calc(var(--app-header-h) + var(--tabs-h));
    overflow: hidden;
    background-color: var(--app-header);
    border-bottom: 1px solid var(--app-glass-border);
    backdrop-filter: var(--app-blur);
    -webkit-backdrop-filter: var(--app-blur);
    transition:
      left 300ms var(--app-ease),
      height 300ms var(--app-ease);
    will-change: left, height;
  }
  .layout-main {
    position: absolute;
    top: calc(var(--app-header-h) + var(--tabs-h));
    right: 0;
    bottom: 0;
    left: var(--side-w);
    z-index: 10;
    overflow: hidden;
    transition:
      top 300ms var(--app-ease),
      left 300ms var(--app-ease);
    will-change: top, left;
  }
  .layout-mask {
    position: absolute;
    inset: 0;
    z-index: 35;
    background-color: var(--app-mask);
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    transition: opacity 260ms var(--app-ease);
  }
  .layout.is-mobile .layout-side {
    z-index: 40;
    width: var(--app-side-w);
    opacity: 1;
    pointer-events: none;
    transform: translateX(-100%);
  }
  .layout.is-mobile:not(.is-collapse) .layout-side {
    pointer-events: auto;
    box-shadow: var(--app-shadow-hover);
    transform: translateX(0);
  }
  .layout.is-mobile:not(.is-collapse) .layout-mask {
    opacity: 1;
    pointer-events: auto;
  }
</style>
