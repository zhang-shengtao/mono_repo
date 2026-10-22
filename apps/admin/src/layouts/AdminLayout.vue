<script setup lang="ts">
import { useAppStore } from "@/stores/app";
import AppBrand from "./components/AppBrand.vue";
import AppHeader from "./components/AppHeader.vue";
import SidebarMenu from "./components/SidebarMenu.vue";

const appStore = useAppStore();
</script>

<template>
  <div class="app-shell">
    <aside class="app-aside" :class="{ 'app-aside--collapsed': appStore.collapsed }">
      <AppBrand :collapsed="appStore.collapsed" />
      <div class="app-aside__menu">
        <SidebarMenu :collapsed="appStore.collapsed" />
      </div>
      <div v-if="!appStore.collapsed" class="app-aside__footer">v0.1.0 · admin</div>
    </aside>

    <div class="app-main">
      <AppHeader />
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>
