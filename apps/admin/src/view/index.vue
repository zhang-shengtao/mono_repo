<script setup lang="ts">
  import zhCn from "element-plus/es/locale/lang/zh-cn";
  import "element-plus/dist/index.css";
  import "element-plus/theme-chalk/dark/css-vars.css";

  const message = {
    max: 2,
  };
</script>

<template>
  <h1>Admin Panel</h1>
  <my-icon name="svg:github" />

  <el-config-provider :locale="zhCn" :message="message">
    <router-view />
  </el-config-provider>
</template>

<style lang="scss" scoped>
  @use "@/assets/global.scss";
</style>
