<script setup lang="ts">
  /**
   * 页面出口：router-view + keep-alive + 过渡 + 内容宽度 + 密度
   *
   * cachedViews 来自 @/layout（页签驱动），页面组件必须
   * defineOptions({ name }) 且与 route.name 完全一致，否则缓存静默失效。
   */
  import layout from "@/layout";

  defineOptions({ name: "MainApp" });

  const route = useRoute();

  const isScreen = computed(() => route.meta.isScreen === true);
  const boxed = computed(() => layout.settings.contentWidth === "boxed");
</script>

<template>
  <main class="app-scroll min-h-0 flex-1 overflow-y-auto" :class="isScreen ? 'p-0' : 'p-[var(--app-page-pad)]'">
    <div class="min-h-full" :class="boxed ? 'mx-auto w-full max-w-[var(--app-content-max)]' : 'w-full'">
      <router-view v-slot="{ Component, route: current }">
        <transition :name="layout.transitionName" mode="out-in">
          <keep-alive :include="layout.cachedViews">
            <component :is="Component" :key="current.path" />
          </keep-alive>
        </transition>
      </router-view>
    </div>
  </main>
</template>
