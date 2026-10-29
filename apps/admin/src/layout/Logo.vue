<script setup lang="ts">
  interface Props {
    collapsed?: boolean;
    standalone?: boolean;
  }

  withDefaults(defineProps<Props>(), {
    collapsed: false,
    standalone: false,
  });

  defineOptions({ name: "LayoutLogo" });
</script>

<template>
  <div class="logo" :class="{ 'is-collapsed': collapsed, 'is-standalone': standalone }">
    <div class="logo-mark">
      <span class="logo-mark-text">M</span>
      <span class="logo-mark-dot" />
    </div>

    <div v-if="!collapsed" class="logo-text">
      <p class="logo-name">Mono Admin</p>
      <p class="logo-sub">管理后台 · v0.1.0</p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    user-select: none;
  }

  .logo-mark {
    position: relative;
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background-image: linear-gradient(
      135deg,
      var(--app-primary),
      color-mix(in srgb, var(--app-primary) 55%, #8b5cf6) 55%,
      color-mix(in srgb, var(--app-primary) 42%, #22d3ee)
    );
    box-shadow: 0 6px 16px color-mix(in srgb, var(--app-primary) 32%, transparent);
  }

  .logo-mark-text {
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    color: #fff;
  }

  .logo-mark-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
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

  .logo-text {
    min-width: 0;
    line-height: 1.25;
    transition: opacity var(--app-dur) var(--app-ease);
  }

  .logo-name {
    margin: 0;
    overflow: hidden;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-sidebar-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logo-sub {
    margin: 0;
    overflow: hidden;
    font-size: 10px;
    color: var(--app-sidebar-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .logo.is-collapsed {
    justify-content: center;
  }

  .logo.is-standalone .logo-name {
    color: var(--app-text);
  }

  .logo.is-standalone .logo-sub {
    color: var(--app-text-3);
  }
</style>
