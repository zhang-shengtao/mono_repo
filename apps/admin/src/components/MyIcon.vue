<script setup lang="ts">
  import * as ElementPlusIconsVue from "@element-plus/icons-vue";

  interface IconProps {
    name: string; // 本地svg就传 svg:[name]，element-plus图标就传 [name]
    size?: number | string;
    color?: string;
  }
  withDefaults(defineProps<IconProps>(), {
    size: 18,
  });
  defineOptions({ name: "MyIcon" });

  const epIcons = ElementPlusIconsVue as unknown as Record<string, Component | undefined>;
</script>

<template>
  <el-icon :size="size" :color="color" class="icon" v-if="epIcons[name]">
    <component :is="epIcons[name]" />
  </el-icon>
  <svg class="icon" v-else aria-hidden="true" :width="size" :height="size" fill="currentColor">
    <use :href="'#app-' + name" :fill="color" />
  </svg>
</template>

<style lang="scss" scoped>
  .icon {
    cursor: pointer;
    vertical-align: middle;
  }
</style>
