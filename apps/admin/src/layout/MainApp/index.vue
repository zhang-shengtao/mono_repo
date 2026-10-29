<script setup lang="ts">
  defineOptions({ name: "MainApp" });

  import layoutData from "@/layout";

  const key = ref("");
  const loading = ref(false);
  const keepAlives = reactive<string[]>([]);

  function myKey(path: string, key: string) {
    return path;
  }
</script>

<template>
  <el-main class="main-app app-scroll" :class="{ 'is-screen': $route.meta.isScreen === true }">
    <router-view #="{ Component, route }">
      <transition :name="layoutData.transitionName" mode="out-in">
        <keep-alive :include="keepAlives">
          <component :is="Component" :key="myKey(route.path, key)" />
        </keep-alive>
      </transition>
    </router-view>
  </el-main>
</template>

<style lang="scss" scoped>
  .main-app {
    width: 100%;
    height: 100%;
    padding: 15px;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: transparent;
  }

  .main-app.is-screen {
    padding: 0;
  }
</style>
