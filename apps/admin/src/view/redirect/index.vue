<script setup lang="ts">
  /**
   * 页内刷新中转
   *
   * 页签「刷新」先跳到 /redirect?to=目标，再 replace 回目标：
   * 壳不会卸载，目标页面拿到一个新实例（keep-alive 里的旧实例在跳转前已被 suspendCache 踢掉）。
   */
  defineOptions({ name: "Redirect" });

  const route = useRoute();
  const router = useRouter();

  onMounted(async () => {
    const target = String(route.query.to ?? "/");
    if (target === route.fullPath) {
      await router.replace("/");
      return;
    }
    await router.replace(target);
  });
</script>

<template>
  <div class="grid h-full min-h-[200px] place-items-center text-[13px] text-ink-3">正在刷新…</div>
</template>
