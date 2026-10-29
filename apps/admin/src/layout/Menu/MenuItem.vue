<script setup lang="ts">
  defineOptions({ name: "MenuItem" });
  import type { RouteRecordRaw } from "vue-router";
  import AppLink from "./AppLink.vue";

  withDefaults(defineProps<{ item: RouteRecordRaw }>(), {});
</script>

<template>
  <el-sub-menu :index="item.path" v-if="item.children && item.children.length">
    <template #title>
      <my-icon v-if="item.meta?.icon" :name="item.meta.icon" />
      <span>{{ (item.meta && item.meta.title) || "默认" }}</span>
    </template>
    <menu-item v-for="items in item.children" :key="items.path" :item="items" />
  </el-sub-menu>

  <app-link v-else :path="item.path" :target="item.meta?.target || false">
    <el-menu-item :index="item.path">
      <my-icon v-if="item.meta && item.meta.icon" :name="item.meta.icon" />
      <template #title> {{ (item.meta && item.meta.title) || "默认" }}</template>
    </el-menu-item>
  </app-link>
</template>
