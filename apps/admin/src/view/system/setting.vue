<script setup lang="ts">
  /**
   * 系统设置占位页（自带页头骨架）
   * name 必须与 route.name 一致，否则 keep-alive 静默失效。
   */
</script>

<template>
  <div class="flex flex-col gap-[var(--app-gap)]">
    <header>
      <h1 class="m-0 text-[22px] font-semibold tracking-tight text-ink">系统设置</h1>
      <p class="mt-1 text-[13px] text-ink-3">占位页：用于验证二级菜单、面包屑、多页签与 keep-alive。</p>
    </header>

    <section class="app-card p-5">
      <h2 class="m-0 text-[16px] font-semibold text-ink">基础配置</h2>
      <p class="mt-1 text-[12.5px] text-ink-3">表单区下一轮接入</p>
      <el-empty description="占位内容" :image-size="88" />
    </section>

    <section class="app-card p-5">
      <h2 class="m-0 text-[16px] font-semibold text-ink">安全策略</h2>
      <p class="mt-1 text-[12.5px] text-ink-3">占位区块</p>
      <el-empty description="占位内容" :image-size="88" />
    </section>
  </div>
</template>
