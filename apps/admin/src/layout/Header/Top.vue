<script setup lang="ts">
  /**
   * 顶部 / 混合布局的一级横向导航
   *
   * 只在 Header 里渲染，所以按子目录规则放在 Header/ 下。
   * index 带 top: 前缀，避免和侧栏菜单的选中态串台。
   */
  import layout from "@/layout";

  defineOptions({ name: "HeaderTop" });

  const route = useRoute();
  const router = useRouter();

  const PREFIX = "top:";

  /** 详情页可以用 meta.activeMenu 指定该高亮哪个一级菜单 */
  const activePath = computed(() => String(route.meta.activeMenu || route.path));
  const activeIndex = computed(() => PREFIX + (layout.getActiveTop(activePath.value)?.path ?? activePath.value));

  function onSelect(index: string) {
    const path = index.startsWith(PREFIX) ? index.slice(PREFIX.length) : index;
    const item = layout.topMenus.find((menu) => menu.path === path);
    if (!item) return;

    if (item.meta.target) {
      window.open(path, "_blank", "noopener");
      return;
    }
    // 一级目录没有自己的页面，跳到它下面第一个叶子页
    const leaf = layout.firstLeafPath(item);
    if (leaf && leaf !== route.path) router.push(leaf);
  }
</script>

<template>
  <el-menu
    class="min-w-0 flex-1"
    mode="horizontal"
    :default-active="activeIndex"
    :ellipsis="true"
    :collapse-transition="false"
    @select="onSelect"
  >
    <el-menu-item v-for="item in layout.topMenus" :key="item.path" :index="PREFIX + item.path">
      <MyIcon v-if="item.meta.icon" :name="item.meta.icon" :size="17" class="mr-1.5" />
      <span>{{ item.meta.title }}</span>
    </el-menu-item>
  </el-menu>
</template>
