<script setup lang="ts">
  defineOptions({ name: "MainApp" });
  import layoutData from "@/layout";
  import type { RouteLocationNormalizedLoadedGeneric } from "@/router";
  import type { ComponentOptions, VNodeTypes } from "vue";

  const keepAlives = computed(() => layoutData.keepAlives.map((item) => item.name));

  function keyStr(path: string) {
    const item = layoutData.tabs.find((item) => item.path === path);
    return `${path}#${item?.key || ""}`;
  }

  watch(
    () => layoutData.tabs.map((item) => item.path).join("\u0000"),
    () => {
      const used = new Set(layoutData.tabs.map((item) => item.path));
      for (let i = layoutData.keepAlives.length - 1; i >= 0; i--) {
        if (used.has(layoutData.keepAlives[i].path) === false) layoutData.keepAlives.splice(i, 1);
      }
    },
  );

  function isOptionsComponent(type: VNodeTypes): type is ComponentOptions {
    return typeof type === "object" && type !== null;
  }
  function getComponentName(comp: VNode): string {
    const type = comp.type;
    if (!isOptionsComponent(type)) return "";
    return type.name || type.__name || "";
  }
  function myComponent(comp: VNode, route: RouteLocationNormalizedLoadedGeneric) {
    if (!layoutData.isShowTabs) return comp;
    const hasTab = layoutData.tabs.some((item) => item.path === route.path);
    const compName = getComponentName(comp);
    if (hasTab && route.meta?.keepAlive === true && compName) {
      void nextTick(() => {
        if (!layoutData.keepAlives.some((item) => item.name === compName)) {
          layoutData.keepAlives.push({ name: compName, path: route.path });
        }
      });
    }
    return comp;
  }
</script>

<template>
  <el-main class="main-app app-scroll" :class="{ 'is-screen': $route.meta.isScreen === true }" v-loading="layoutData.mainAppLadding" element-loading-text="加载中">
    <router-view #="{ Component, route }">
      <transition :name="layoutData.transitionName" mode="out-in">
        <keep-alive :include="keepAlives">
          <component :is="myComponent(Component, route)" :key="keyStr(route.path)" />
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

    /* 加载圈的尺寸：Element 的遮罩、圈线、文案本来就用 --el-color-primary，换个字号就够 */
    --el-loading-spinner-size: 34px;
  }

  .main-app.is-screen {
    padding: 0;
  }

  /* 遮罩换成主题底色的磨砂玻璃，跟侧栏 / 头部一套材质，而不是默认的纯白/灰底 */
  .main-app :deep(.el-loading-mask) {
    background-color: color-mix(in srgb, var(--app-bg) 62%, transparent);
    backdrop-filter: blur(6px) saturate(140%);
    -webkit-backdrop-filter: blur(6px) saturate(140%);
  }

  /* 圈线粗一点、转得快一点，叠一圈主题色辉光；文案用主题色 + 字距，跟项目里的标题观感一致 */
  .main-app :deep(.el-loading-spinner) {
    .circular {
      animation-duration: 1.5s;
    }

    .path {
      stroke-width: 3px;
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--el-color-primary) 60%, transparent));
    }

    .el-loading-text {
      margin-top: 8px;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.08em;
    }
  }
</style>
