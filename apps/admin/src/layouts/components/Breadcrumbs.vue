<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { findMenuChain, menuTitle } from "@/utils/menu";

const auth = useAuthStore();
const route = useRoute();

const items = computed(() => {
  const chain = findMenuChain(auth.menus, route.path);
  if (chain.length > 0) return chain.map((menu) => menuTitle(menu));
  return route.meta.title ? [String(route.meta.title)] : [];
});
</script>

<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
    <el-breadcrumb-item v-for="(item, index) in items" :key="index">{{ item }}</el-breadcrumb-item>
  </el-breadcrumb>
</template>
