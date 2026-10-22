<script setup lang="ts">
defineProps<{ collapsed: boolean }>();
</script>

<template>
  <div class="app-brand">
    <div class="app-brand__mark">A</div>
    <span v-if="!collapsed" class="app-brand__text">管理后台</span>
  </div>
</template>
