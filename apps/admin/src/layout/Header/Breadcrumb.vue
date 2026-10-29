<script setup lang="ts">
  defineOptions({ name: "LayoutBreadcrumb" });

  const route = useRoute();

  const crumbs = computed(() => route.matched.filter((item) => item.meta?.title && item.path !== "/"));
</script>

<template>
  <el-breadcrumb class="breadcrumb" separator="/">
    <el-breadcrumb-item v-for="item in crumbs" :key="item.path">
      {{ item.meta.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<style lang="scss" scoped>
  .breadcrumb {
    min-width: 0;
    font-size: 13px;
    line-height: 1;

    :deep(.el-breadcrumb__inner) {
      color: var(--app-text-2);
      font-weight: 400;
      transition: color var(--app-dur) var(--app-ease);
    }

    :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
      color: var(--app-text);
      font-weight: 600;
    }

    :deep(.el-breadcrumb__separator) {
      color: var(--app-text-3);
      margin: 0 6px;
    }
  }
</style>
