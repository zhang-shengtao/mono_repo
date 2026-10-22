<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { Odometer } from "@element-plus/icons-vue";
import { useAuthStore } from "@/stores/auth";
import type { MenuNode } from "@/types/menu";
import { filterSidebarMenus, metaString } from "@/utils/menu";
import SidebarMenuItem from "./SidebarMenuItem.vue";

defineProps<{ collapsed: boolean }>();

const auth = useAuthStore();
const route = useRoute();

const menus = computed(() => filterSidebarMenus(auth.menus));
const activePath = computed(() => route.path);

/** 数据库里已经配了 /dashboard 时不要再渲染内置的那一条 */
const hasDashboardMenu = computed(() => {
  const contains = (nodes: MenuNode[]): boolean =>
    nodes.some((node) => metaString(node.meta, "path") === "/dashboard" || contains(node.children ?? []));
  return contains(auth.menus);
});
</script>

<template>
  <el-menu :default-active="activePath" :collapse="collapsed" :collapse-transition="false" router unique-opened>
    <el-menu-item v-if="!hasDashboardMenu" index="/dashboard">
      <el-icon><Odometer /></el-icon>
      <template #title>仪表盘</template>
    </el-menu-item>
    <SidebarMenuItem v-for="menu in menus" :key="menu.admin_menus_id" :item="menu" />
  </el-menu>
</template>
