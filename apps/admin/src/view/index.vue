<script setup lang="ts">
  import zhCn from "element-plus/es/locale/lang/zh-cn";

  const message = {
    max: 2,
  };
</script>

<template>
  <el-config-provider :locale="zhCn" :message="message">
    <router-view />
  </el-config-provider>
</template>
