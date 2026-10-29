<script setup lang="ts">
  defineOptions({ name: "LayoutHeader" });

  import Left from "./Left.vue";
  import Right from "./Right.vue";
  import Tabs from "./Tabs.vue";
  import Top from "./Top.vue";
  import Logo from "../Logo.vue";
  import layoutData from "@/layout";

  const route = useRoute();

  const showTopMenu = computed(() => !layoutData.isMobile && layoutData.layoutStyle !== "side");

  // 顶部布局，以及「混合布局里当前模块没有二级菜单」时，品牌标识挂在顶栏上
  const showLogo = computed(
    () => layoutData.isShowLogo && !layoutData.isMobile && (layoutData.layoutStyle === "top" || (layoutData.layoutStyle === "mix" && layoutData.getModuleMenus(route.path).length === 0)),
  );
</script>

<template>
  <div class="header">
    <div class="header-bar">
      <Logo v-if="showLogo" standalone />
      <Left />
      <Top v-if="showTopMenu" />
      <Right />
    </div>
    <Tabs v-if="layoutData.isShowTabs" />
  </div>
</template>

<style lang="scss" scoped>
  .header {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .header-bar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
    height: var(--app-header-h);
    padding: 0 10px;
  }
</style>
