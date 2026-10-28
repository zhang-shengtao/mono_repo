<script setup lang="ts">
  /**
   * 视觉标记 + 品牌文案
   *
   * 名称 / 副标题 / 版本号本轮直接写死在模板里（占位，后续替换），
   * 不建常量、不建 config/。
   */
  interface Props {
    /** 折叠时只留方块 */
    collapsed?: boolean;
    /** 独立使用（顶栏里），文字用正文色而不是侧栏色 */
    standalone?: boolean;
  }

  withDefaults(defineProps<Props>(), {
    collapsed: false,
    standalone: false,
  });
</script>

<template>
  <div
    class="app-logo flex items-center gap-2.5 overflow-hidden select-none"
    :class="{ 'is-collapsed': collapsed, 'is-standalone': standalone }"
  >
    <div
      class="app-logo-mark relative grid size-9 shrink-0 place-items-center rounded-inner bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#22d3ee] shadow-[0_8px_20px_rgba(99,102,241,.35)]"
    >
      <span class="text-[15px] font-bold text-white">M</span>
      <span class="app-logo-dot absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-white/90" />
    </div>

    <div v-if="!collapsed" class="min-w-0 leading-tight">
      <p class="app-logo-name truncate text-[15px] font-semibold tracking-tight">Mono Admin</p>
      <p class="app-logo-sub truncate text-[11px]">管理后台 · v0.1.0</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .app-logo-name {
    color: var(--app-sidebar-text);
  }

  .app-logo-sub {
    color: var(--app-sidebar-text-2);
  }

  .is-standalone .app-logo-name {
    color: var(--app-text);
  }

  .is-standalone .app-logo-sub {
    color: var(--app-text-3);
  }

  // 微光呼吸（prefers-reduced-motion 已在 global.scss 全局关掉）
  .app-logo-dot {
    animation: logo-glow 6s ease-in-out infinite;
  }

  @keyframes logo-glow {
    0%,
    100% {
      opacity: 0.55;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.35);
    }
  }
</style>
