<script setup lang="ts">
  /**
   * 面包屑：自己用 route.matched 推导，不依赖菜单数据
   */
  defineOptions({ name: "LayoutBreadcrumb" });

  const route = useRoute();
  const router = useRouter();

  interface Crumb {
    title: string;
    path: string;
    clickable: boolean;
  }

  const crumbs = computed<Crumb[]>(() => {
    const matched = route.matched.filter((item) => item.meta?.title && !item.meta?.hidden);
    return matched.map((item, index) => ({
      title: String(item.meta.title),
      path: item.path,
      clickable: index < matched.length - 1,
    }));
  });

  function onClick(crumb: Crumb) {
    if (!crumb.clickable) return;
    const target = router.resolve(crumb.path);
    // 目录级路径带 redirect，交给路由自己跳到第一个叶子页
    if (target.matched.length) router.push(crumb.path);
  }
</script>

<template>
  <nav v-if="crumbs.length" class="flex min-w-0 items-center gap-1.5 text-[13px]">
    <template v-for="(crumb, index) in crumbs" :key="crumb.path">
      <span v-if="index > 0" class="shrink-0 text-ink-3">/</span>
      <button
        v-if="crumb.clickable"
        type="button"
        class="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-ink-2 transition-colors hover:text-primary"
        @click="onClick(crumb)"
      >
        {{ crumb.title }}
      </button>
      <span v-else class="shrink-0 font-medium text-ink">{{ crumb.title }}</span>
    </template>
  </nav>
</template>
