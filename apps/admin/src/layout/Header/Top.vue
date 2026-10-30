<script setup lang="ts">
  defineOptions({ name: "LayoutHeaderTop" });

  import layoutData from "@/layout";
  import MenuItem from "../Menu/MenuItem.vue";
  import type { RouteRecordRaw } from "@/router";

  const route = useRoute();
  const router = useRouter();

  const menus = computed(() => layoutData.menuList);

  const activePath = computed(() => layoutData.getActiveTop(route.path)?.path ?? route.path);

  /** 一级菜单悬停下拉：只记录当前展开的那一项 */
  const openPath = ref("");
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function childrenOf(item: RouteRecordRaw) {
    return item.children ?? [];
  }

  function firstLeafPath(item: RouteRecordRaw): string {
    const children = childrenOf(item);
    if (children.length) {
      for (const child of children) {
        const path = firstLeafPath(child);
        if (path) return path;
      }
      return "";
    }
    return item.path;
  }

  function openMenu(path: string) {
    if (!path) return;
    clearTimeout(closeTimer);
    closeTimer = undefined;
    openPath.value = path;
  }

  function closeMenuSoon(delay = 160) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      openPath.value = "";
    }, delay);
  }

  function closeMenu() {
    clearTimeout(closeTimer);
    openPath.value = "";
  }

  function onSelect(item: RouteRecordRaw) {
    if (item.path.startsWith("http") || item.meta?.target) {
      window.open(item.path, "_blank", "noopener");
      return;
    }

    const leaf = firstLeafPath(item);
    if (leaf && leaf !== route.path) router.push(leaf);
  }

  function onPopoverClick(event: MouseEvent) {
    // 只有点到真正会跳转的菜单项才收起；点二级标题只是展开/收起分组
    const clickedItem = (event.target as HTMLElement | null)?.closest(".el-menu-item");
    if (clickedItem) closeMenu();
  }

  // 路由变化（含点击下拉里的子菜单）后收起下拉
  watch(
    () => route.fullPath,
    () => closeMenu(),
  );

  onBeforeUnmount(() => clearTimeout(closeTimer));
</script>

<template>
  <nav class="header-top app-scroll-none">
    <el-popover
      v-for="item in menus"
      :key="item.path"
      :visible="openPath === item.path"
      :teleported="true"
      :width="200"
      placement="bottom-start"
      :show-arrow="false"
      :offset="6"
      :gpu-acceleration="false"
      popper-class="app-top-popover"
      transition="el-zoom-in-top"
    >
      <template #reference>
        <button
          type="button"
          class="top-item"
          :class="{ 'is-active': item.path === activePath, 'is-open': openPath === item.path }"
          :aria-haspopup="childrenOf(item).length ? 'menu' : undefined"
          :aria-expanded="childrenOf(item).length ? openPath === item.path : undefined"
          @mouseenter="childrenOf(item).length && openMenu(item.path)"
          @mouseleave="closeMenuSoon()"
          @focus="childrenOf(item).length && openMenu(item.path)"
          @blur="closeMenuSoon()"
          @click="onSelect(item)"
        >
          <my-icon v-if="item.meta?.icon" :name="item.meta.icon" :size="15" />
          <span class="top-item-text">{{ item.meta?.title }}</span>
          <my-icon v-if="childrenOf(item).length" class="top-item-arrow" name="ArrowDown" :size="11" />
        </button>
      </template>

      <div v-if="childrenOf(item).length" class="top-popover-body" @mouseenter="openMenu(item.path)" @mouseleave="closeMenuSoon()" @click="onPopoverClick">
        <el-menu class="top-popover-menu" :default-active="route.path" :collapse-transition="false" unique-opened>
          <MenuItem v-for="child in childrenOf(item)" :key="child.path" :item="child" />
        </el-menu>
      </div>
    </el-popover>
  </nav>
</template>

<style lang="scss" scoped>
  .header-top {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .top-item {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 9px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--app-text-2);
    font-family: inherit;
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease),
      border-color var(--app-dur) var(--app-ease);

    &:hover,
    &.is-open {
      color: var(--app-text);
      background-color: color-mix(in srgb, var(--app-primary) 8%, transparent);
    }

    &.is-active {
      color: var(--app-primary);
      font-weight: 600;
      border-color: color-mix(in srgb, var(--app-primary) 24%, transparent);
      background-color: color-mix(in srgb, var(--app-primary) 12%, transparent);
    }
  }

  .top-item-text {
    line-height: 1;
  }

  .top-item-arrow {
    transition: transform var(--app-dur) var(--app-ease);
  }

  .top-item.is-open .top-item-arrow {
    transform: rotate(180deg);
  }
</style>

<style lang="scss">
  /* 下拉面板被 teleport 到 body，样式必须全局写 */
  .app-top-popover.el-popover.el-popper {
    min-width: 0;
    padding: 6px;
    border: 1px solid var(--app-glass-border);
    border-radius: var(--app-radius);
    background: var(--app-surface);
    backdrop-filter: var(--app-blur);
    -webkit-backdrop-filter: var(--app-blur);
    box-shadow: var(--app-shadow);
  }

  .app-top-popover .top-popover-body {
    display: flex;
    flex-direction: column;
  }

  .app-top-popover .top-popover-menu {
    border: 0;
    background: transparent;
  }

  .app-top-popover .top-popover-menu .el-menu-item,
  .app-top-popover .top-popover-menu .el-sub-menu__title {
    height: 34px;
    font-size: 13px;
    line-height: 34px;
  }

  .app-top-popover .top-popover-menu .el-menu-item.is-active {
    background-color: color-mix(in srgb, var(--app-primary) 12%, transparent);
  }
</style>
