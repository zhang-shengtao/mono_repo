<script setup lang="ts">
  /**
   * 递归菜单项
   *
   * 不做跳转：点击由 el-menu 的 select 事件统一处理（index 带前缀，避免顶栏/侧栏串台）。
   */
  import type { MenuItem } from "@/types/menu";

  defineOptions({ name: "LayoutMenuItem" });

  const props = defineProps<{
    item: MenuItem;
    /** el-menu 的 index 前缀，区分顶栏与侧栏两套菜单 */
    prefix: string;
  }>();

  const children = computed(() =>
    (props.item.children ?? []).filter((child) => !child.meta.hidden && child.type !== "button"),
  );
</script>

<template>
  <el-sub-menu v-if="children.length" :index="prefix + item.path">
    <template #title>
      <MyIcon v-if="item.meta.icon" :name="item.meta.icon" :size="18" class="mr-2 shrink-0" />
      <span class="truncate">{{ item.meta.title }}</span>
    </template>

    <MenuItem v-for="child in children" :key="child.path" :item="child" :prefix="prefix" />
  </el-sub-menu>

  <el-menu-item v-else :index="prefix + item.path">
    <MyIcon v-if="item.meta.icon" :name="item.meta.icon" :size="18" class="mr-2 shrink-0" />
    <template #title>
      <span class="flex-1 truncate">{{ item.meta.title }}</span>
      <span v-if="item.meta.badge" class="app-menu-badge">{{ item.meta.badge }}</span>
    </template>
  </el-menu-item>
</template>

<style lang="scss" scoped>
  .app-menu-badge {
    margin-left: 6px;
    padding: 0 6px;
    font-size: 11px;
    line-height: 16px;
    color: #fff;
    background: linear-gradient(120deg, #6366f1, #8b5cf6);
    border-radius: var(--app-radius-pill);
  }
</style>
