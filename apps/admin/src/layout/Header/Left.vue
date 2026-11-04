<script setup lang="ts">
  defineOptions({ name: "LayoutHeaderLeft" });

  import Breadcrumb from "./Breadcrumb.vue";
  import layoutData from "@/layout";

  const route = useRoute();

  const hasSide = computed(() => layoutData.layoutStyle !== "top" && !(layoutData.layoutStyle === "mix" && layoutData.getModuleMenus(route.path).length === 0));

  const showToggle = computed(() => layoutData.isMobile || hasSide.value);

  const showBreadcrumb = computed(() => layoutData.isShowBreadcrumbs && !layoutData.isMobile && layoutData.layoutStyle === "side");
</script>

<template>
  <div class="header-left">
    <button v-if="showToggle" type="button" class="app-icon-btn" :title="layoutData.isCollapse ? '展开菜单' : '收起菜单'" @click="layoutData.isCollapse = !layoutData.isCollapse">
      <my-icon :name="layoutData.isCollapse ? 'Expand' : 'Fold'" :size="18" />
    </button>
    <Breadcrumb v-if="showBreadcrumb" />
  </div>
</template>

<style lang="scss" scoped>
  .header-left {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
</style>
