<script setup lang="ts">
/** 递归渲染一个菜单节点：目录 → 子菜单，页面 → 可点击项 */
import { computed } from "vue";
import type { MenuNode } from "@/types/menu";
import { menuTitle, metaString } from "@/utils/menu";

defineOptions({ name: "SidebarMenuItem" });

const props = defineProps<{ item: MenuNode }>();

const title = computed(() => menuTitle(props.item));
const icon = computed(() => metaString(props.item.meta, "icon"));
const path = computed(() => metaString(props.item.meta, "path"));
const children = computed(() =>
  (props.item.children ?? []).filter((item) => item.type !== "button" && !item.is_disabled),
);
</script>

<template>
  <el-sub-menu
    v-if="props.item.type === 'directory' && children.length > 0"
    :index="path || String(props.item.admin_menus_id)"
  >
    <template #title>
      <el-icon v-if="icon"><component :is="icon" /></el-icon>
      <span>{{ title }}</span>
    </template>
    <SidebarMenuItem v-for="child in children" :key="child.admin_menus_id" :item="child" />
  </el-sub-menu>

  <el-menu-item v-else-if="props.item.type === 'page' && path" :index="path">
    <el-icon v-if="icon"><component :is="icon" /></el-icon>
    <template #title>{{ title }}</template>
  </el-menu-item>
</template>
