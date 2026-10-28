<script setup lang="ts">
  /**
   * 顶栏左区：移动端汉堡 / 侧栏折叠 / 面包屑
   */
  import Breadcrumb from "./Breadcrumb.vue";
  import layout from "@/layout";

  defineOptions({ name: "HeaderLeft" });

  /** top 布局没有侧栏，不显示折叠按钮 */
  const showCollapse = computed(() => !layout.isMobile && layout.settings.layoutStyle !== "top");
</script>

<template>
  <div class="flex min-w-0 items-center gap-1.5">
    <el-button v-if="layout.isMobile" text circle @click="layout.toggleMobileMenu()">
      <MyIcon name="Expand" :size="18" />
    </el-button>

    <el-button v-else-if="showCollapse" text circle @click="layout.toggleCollapse()">
      <MyIcon :name="layout.settings.isCollapse ? 'Expand' : 'Fold'" :size="18" />
    </el-button>

    <Breadcrumb v-if="layout.settings.isShowBreadcrumbs && !layout.isMobile" class="ml-1" />
  </div>
</template>
