<template>
  <Header />
  <MainApp />
  <Menu />
</template>

<script setup lang="ts" name="Layout">
  import userPinia from "@/pinia/user";
  import { Header, MainApp, Menu } from "./index";
  const { menuList } = userPinia();
</script>
