<script setup lang="ts">
  /**
   * 侧栏
   *
   * 品牌位是 <slot name="logo" />，由壳注入 Logo（不 import setting/Logo.vue，守子目录规则）
   */
  import MenuItem from "./MenuItem.vue";
  import layout from "@/layout";
  import type { MenuItem as MenuItemType } from "@/types/menu";

  defineOptions({ name: "LayoutMenu" });

  const props = withDefaults(
    defineProps<{
      /** 移动端抽屉里渲染：不折叠、点完自动收起 */
      mobile?: boolean;
    }>(),
    { mobile: false },
  );

  const route = useRoute();
  const router = useRouter();

  /** index 前缀：侧栏与顶栏是两套 el-menu，不加前缀选中态会互相串台 */
  const PREFIX = "side:";

  const menus = computed(() => layout.getSideMenus(route.path));
  const collapsed = computed(() => !props.mobile && !layout.isMobile && layout.settings.isCollapse);
  const activeIndex = computed(() => PREFIX + String(route.meta.activeMenu || route.path));

  function findItem(list: MenuItemType[], path: string): MenuItemType | undefined {
    for (const item of list) {
      if (item.path === path) return item;
      const hit = item.children?.length ? findItem(item.children, path) : undefined;
      if (hit) return hit;
    }
    return undefined;
  }

  function onSelect(index: string) {
    const path = index.startsWith(PREFIX) ? index.slice(PREFIX.length) : index;
    const item = findItem(menus.value, path);

    if (item?.meta.target) {
      window.open(path, "_blank", "noopener");
    } else if (path !== route.path) {
      router.push(path);
    }

    if (props.mobile) layout.closeMobileMenu();
  }

  function reload() {
    layout.reloadMenus();
  }
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      v-if="layout.settings.isShowLogo"
      class="flex h-[var(--app-header-h)] shrink-0 items-center px-4"
      :class="{ 'justify-center px-0': collapsed }"
    >
      <slot name="logo" />
    </div>

    <el-scrollbar class="min-h-0 flex-1">
      <el-menu
        v-if="menus.length"
        :default-active="activeIndex"
        :collapse="collapsed"
        :collapse-transition="false"
        unique-opened
        @select="onSelect"
      >
        <MenuItem v-for="item in menus" :key="item.path" :item="item" :prefix="PREFIX" />
      </el-menu>

      <div v-else class="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <MyIcon name="Files" :size="28" color="var(--app-text-3)" />
        <p class="text-[13px] text-ink-3">暂无可用菜单</p>
        <el-button size="small" text type="primary" @click="reload">重新加载</el-button>
      </div>
    </el-scrollbar>
  </div>
</template>
