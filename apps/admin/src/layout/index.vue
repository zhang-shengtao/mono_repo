<!-- 这个文件负责组织布局组件的各个子组件 -->
<template>
  <Header />
  <MainApp />
  <Menu />
  <Stting />
</template>

<script setup lang="ts" name="Layout">
  import Header from "./Header/index.vue";
  import MainApp from "./MainApp/index.vue";
  import Menu from "./Menu/index.vue";
  import Stting from "./setting/index.vue";
</script>
