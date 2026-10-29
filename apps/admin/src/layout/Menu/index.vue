<script setup lang="ts">
  defineOptions({ name: "LayoutMenu" });

  import MenuItem from "./MenuItem.vue";
  import Logo from "../Logo.vue";
  import layoutData from "@/layout";

  const route = useRoute();

  const collapsed = computed(() => !layoutData.isMobile && layoutData.isCollapse);

  // 混合布局的侧栏只放当前一级模块的子菜单，模块没有子菜单时退回完整菜单
  // menuList 已在 pinia/user.ts 的 menuArr 里剔除 hidden，无需再过滤
  const menus = computed(() => {
    const all = layoutData.menuList;
    if (layoutData.layoutStyle !== "mix") return all;

    const moduleMenus = layoutData.getModuleMenus(route.path);
    return moduleMenus.length ? moduleMenus : all;
  });
</script>

<template>
  <div class="menu">
    <div v-if="layoutData.isShowLogo" class="menu-logo" :class="{ 'is-collapsed': collapsed }">
      <Logo :collapsed="collapsed" />
    </div>

    <el-scrollbar class="menu-scroll">
      <el-menu class="menu-el" :default-active="route.path" :collapse="collapsed" :collapse-transition="false" unique-opened>
        <MenuItem v-for="item in menus" :key="item.path" :item="item" />
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style lang="scss" scoped>
  .menu {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .menu-logo {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    height: var(--app-header-h);
    padding: 0 14px;
    overflow: hidden;
    transition: padding 280ms var(--app-ease);
  }

  .menu-logo.is-collapsed {
    justify-content: center;
    padding: 0;
  }

  .menu-scroll {
    flex: 1;
    min-height: 0;
  }

  .menu-scroll.menu-scroll {
    height: auto;
  }

  .menu-scroll :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
  }

  .menu-el {
    padding: 4px 0;
    background-color: transparent;
    border-right: none;
  }

  .menu-scroll :deep(.el-scrollbar__bar.is-vertical) {
    right: -2px;
  }

  .menu-scroll :deep(.el-scrollbar__bar.is-horizontal) {
    display: none;
  }
</style>
