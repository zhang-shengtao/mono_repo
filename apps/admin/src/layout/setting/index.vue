<script setup lang="ts">
  defineOptions({ name: "LayoutSetting" });
  import { DEFAULT_LAYOUT_SETTINGS, LAYOUT_STYLE_OPTIONS, PAGE_STYLE_OPTIONS, PRIMARY_PRESETS, THEME_OPTIONS, default as layoutData } from "@/layout";
  import type { SwitchPageStyle } from "@/layout";

  function onColorChange(value: string | null) {
    if (value) layoutData.primaryColor = value;
  }
  function resetLayout() {
    Object.assign(layoutData, DEFAULT_LAYOUT_SETTINGS, { isCollapse: layoutData.isMobile });
  }

  const replayKey = reactive<Record<string, number>>({});
  function selectPageStyle(value: SwitchPageStyle) {
    layoutData.switchPageStyle = value;
    replayKey[value] = (replayKey[value] ?? 0) + 1;
  }
</script>

<template>
  <el-drawer v-model="layoutData.isSettingOpen" class="app-setting-drawer" title="外观设置" direction="rtl" size="340px" :z-index="3500">
    <div class="setting">
      <section class="setting-group">
        <p class="setting-label">布局模式</p>
        <div class="setting-modes">
          <button
            v-for="item in LAYOUT_STYLE_OPTIONS"
            :key="item.value"
            type="button"
            class="mode"
            :class="[`is-${item.value}`, { 'is-active': layoutData.layoutStyle === item.value }]"
            @click="layoutData.layoutStyle = item.value"
          >
            <span class="mode-preview">
              <i class="pv-side" />
              <i class="pv-head" />
              <i class="pv-body" />
            </span>
            <span class="mode-text">{{ item.label }}</span>
          </button>
        </div>
      </section>
      <section class="setting-group">
        <p class="setting-label">主题模式</p>
        <div class="setting-chips">
          <button
            v-for="item in THEME_OPTIONS"
            :key="item.value"
            type="button"
            class="chip"
            :class="{ 'is-active': layoutData.theme === item.value }"
            @click="layoutData.theme = item.value"
          >
            <my-icon :name="item.icon" :size="15" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </section>
      <section class="setting-group">
        <p class="setting-label">侧栏明暗</p>
        <div class="setting-chips">
          <button type="button" class="chip" :class="{ 'is-active': layoutData.sidebarTheme === 'light' }" @click="layoutData.sidebarTheme = 'light'">浅色玻璃</button>
          <button type="button" class="chip" :class="{ 'is-active': layoutData.sidebarTheme === 'dark' }" @click="layoutData.sidebarTheme = 'dark'">深色</button>
        </div>
      </section>
      <section class="setting-group">
        <p class="setting-label">主题色</p>
        <div class="setting-colors">
          <button
            v-for="color in PRIMARY_PRESETS"
            :key="color"
            type="button"
            class="color"
            :class="{ 'is-active': layoutData.primaryColor === color }"
            :style="{ '--swatch': color }"
            :title="color"
            @click="layoutData.primaryColor = color"
          />
          <el-color-picker :model-value="layoutData.primaryColor" size="small" @change="onColorChange" />
        </div>
      </section>
      <section class="setting-group">
        <p class="setting-label">视觉材质</p>
        <div class="setting-chips">
          <button type="button" class="chip" :class="{ 'is-active': layoutData.material === 'glass' }" @click="layoutData.material = 'glass'">渐变玻璃</button>
          <button type="button" class="chip" :class="{ 'is-active': layoutData.material === 'solid' }" @click="layoutData.material = 'solid'">纯色</button>
        </div>
      </section>
      <section class="setting-group">
        <div class="setting-head">
          <p class="setting-label">页面切换动效</p>
          <span class="setting-hint">循环预览 · 点击应用</span>
        </div>
        <div class="setting-effects">
          <button
            v-for="(item, index) in PAGE_STYLE_OPTIONS"
            :key="item.value"
            type="button"
            class="effect"
            :class="[`fx-${item.value}`, { 'is-active': layoutData.switchPageStyle === item.value }]"
            :style="{ '--fx-delay': `${layoutData.switchPageStyle === item.value ? 0 : index * 120}ms` }"
            :title="item.label"
            :aria-pressed="layoutData.switchPageStyle === item.value"
            @click="selectPageStyle(item.value)"
          >
            <span class="effect-stage">
              <span :key="replayKey[item.value] ?? 0" class="effect-page">
                <i class="effect-head" />
                <i class="effect-line" />
                <i class="effect-line is-mid" />
              </span>
            </span>
            <span class="effect-text">{{ item.label }}</span>
          </button>
        </div>
      </section>
      <section class="setting-group">
        <p class="setting-label">元素显示</p>
        <div class="setting-switches">
          <div class="switch-row">
            <span class="switch-text">面包屑</span>
            <el-switch v-model="layoutData.isShowBreadcrumbs" size="small" />
          </div>
          <div class="switch-row">
            <span class="switch-text">多页签</span>
            <el-switch v-model="layoutData.isShowTabs" size="small" />
          </div>
          <div class="switch-row">
            <span class="switch-text">Logo</span>
            <el-switch v-model="layoutData.isShowLogo" size="small" />
          </div>
          <div v-if="!layoutData.isMobile" class="switch-row">
            <span class="switch-text">侧栏收起</span>
            <el-switch v-model="layoutData.isCollapse" size="small" />
          </div>
        </div>
      </section>
      <el-divider class="setting-divider" />
      <el-button class="setting-reset" @click="resetLayout">恢复默认</el-button>
      <p class="setting-tip">设置会自动保存在本地</p>
    </div>
  </el-drawer>
</template>

<style lang="scss" scoped>
  .setting {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .setting-label {
    margin: 0;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--app-text-2);
  }

  .setting-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .setting-hint {
    font-size: 10.5px;
    line-height: 1;
    color: var(--app-text-3);
  }

  /* ── 页面切换动效：每个卡片自带一段循环预览 ─────────────── */
  .setting-effects {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .effect {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 7px 4px 6px;
    border: 1px solid color-mix(in srgb, var(--app-text-3) 16%, transparent);
    border-radius: var(--app-radius);
    background: color-mix(in srgb, var(--app-text-3) 4%, transparent);
    font-family: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      border-color var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease),
      transform var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease);

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--app-primary) 32%, transparent);
    }

    &:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--app-primary) 55%, transparent);
      outline-offset: 1px;
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--app-primary) 48%, transparent);
      background: color-mix(in srgb, var(--app-primary) 10%, transparent);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--app-primary) 14%, transparent);

      .effect-text {
        color: var(--app-primary);
        font-weight: 600;
      }

      .effect-head {
        background: color-mix(in srgb, var(--app-primary) 70%, transparent);
      }
    }
  }

  .effect-stage {
    position: relative;
    display: block;
    width: 100%;
    height: 38px;
    overflow: hidden;
    border-radius: 7px;
    perspective: 260px;
    background: radial-gradient(circle at 30% 0%, color-mix(in srgb, var(--app-primary) 16%, transparent), transparent 68%), color-mix(in srgb, var(--app-text-3) 9%, transparent);
  }

  .effect-page {
    position: absolute;
    inset: 6px 7px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
    overflow: hidden;
    border-radius: 4px;
    background: var(--app-solid);
    box-shadow: 0 2px 7px color-mix(in srgb, var(--app-text) 14%, transparent);
    will-change: transform, opacity;
    animation-duration: 2.4s;
    animation-timing-function: var(--app-ease);
    animation-iteration-count: infinite;
    animation-delay: var(--fx-delay, 0ms);
    animation-fill-mode: both;
  }

  .effect-head {
    width: 62%;
    height: 5px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--app-primary) 45%, transparent);
  }

  .effect-line {
    height: 2px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--app-text-3) 24%, transparent);

    &.is-mid {
      width: 76%;
    }
  }

  .effect-text {
    font-size: 11.5px;
    line-height: 1.2;
    color: var(--app-text-2);
    white-space: nowrap;
  }

  .fx-zoom .effect-page {
    animation-name: fx-zoom;
  }

  .fx-fadeIn .effect-page {
    animation-name: fx-fade;
  }

  .fx-slide .effect-page {
    animation-name: fx-slide;
  }

  .fx-rise .effect-page {
    animation-name: fx-rise;
  }

  .fx-blur .effect-page {
    animation-name: fx-blur;
  }

  .fx-3D .effect-page {
    animation-name: fx-3d;
  }

  .fx-flip .effect-page {
    transform-origin: 50% 0;
    animation-name: fx-flip;
  }

  .fx-reveal .effect-page {
    animation-name: fx-reveal;
  }

  .fx-none .effect-page {
    animation: none;
  }

  // 用户系统里关掉动效时，预览停在「静态页面」而不是空白
  @media (prefers-reduced-motion: reduce) {
    .effect-page {
      animation-name: none !important;
    }
  }

  @keyframes fx-zoom {
    0% {
      opacity: 0;
      transform: scale(0.55) translateY(6px);
    }

    22%,
    82% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }

    96%,
    100% {
      opacity: 0;
      transform: scale(0.86) translateY(-4px);
    }
  }

  @keyframes fx-fade {
    0% {
      opacity: 0;
    }

    22%,
    82% {
      opacity: 1;
    }

    96%,
    100% {
      opacity: 0;
    }
  }

  @keyframes fx-slide {
    0% {
      opacity: 0;
      transform: translateX(88%);
    }

    24%,
    82% {
      opacity: 1;
      transform: translateX(0);
    }

    96%,
    100% {
      opacity: 0;
      transform: translateX(-64%);
    }
  }

  @keyframes fx-rise {
    0% {
      opacity: 0;
      transform: translateY(82%);
    }

    24%,
    82% {
      opacity: 1;
      transform: translateY(0);
    }

    96%,
    100% {
      opacity: 0;
      transform: translateY(-52%);
    }
  }

  @keyframes fx-blur {
    0% {
      opacity: 0;
      filter: blur(5px);
      transform: scale(1.06);
    }

    28%,
    82% {
      opacity: 1;
      filter: blur(0);
      transform: scale(1);
    }

    96%,
    100% {
      opacity: 0;
      filter: blur(4px);
      transform: scale(0.96);
    }
  }

  @keyframes fx-3d {
    0% {
      opacity: 0;
      transform: rotateY(-58deg) translateX(30%);
    }

    28%,
    82% {
      opacity: 1;
      transform: rotateY(0deg) translateX(0);
    }

    96%,
    100% {
      opacity: 0;
      transform: rotateY(46deg) translateX(-28%);
    }
  }

  @keyframes fx-flip {
    0% {
      opacity: 0;
      transform: rotateX(-72deg) translateY(18%);
    }

    28%,
    82% {
      opacity: 1;
      transform: rotateX(0deg) translateY(0);
    }

    96%,
    100% {
      opacity: 0;
      transform: rotateX(52deg) translateY(-14%);
    }
  }

  @keyframes fx-reveal {
    0%,
    4% {
      clip-path: inset(0 0 100% 0);
    }

    28%,
    82% {
      clip-path: inset(0 0 0 0);
    }

    96%,
    100% {
      clip-path: inset(100% 0 0 0);
    }
  }

  .setting-modes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 4px;
    border: 1px solid color-mix(in srgb, var(--app-text-3) 16%, transparent);
    border-radius: var(--app-radius);
    background: color-mix(in srgb, var(--app-text-3) 4%, transparent);
    cursor: pointer;
    transition:
      border-color var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease),
      transform var(--app-dur) var(--app-ease);

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--app-primary) 32%, transparent);
    }

    &.is-active {
      border-color: color-mix(in srgb, var(--app-primary) 48%, transparent);
      background: color-mix(in srgb, var(--app-primary) 10%, transparent);

      .mode-text {
        color: var(--app-primary);
        font-weight: 600;
      }

      .pv-side,
      .pv-head,
      .pv-body,
      .pv-nav {
        background: color-mix(in srgb, var(--app-primary) 55%, transparent);
      }
    }
  }

  .mode-text {
    font-size: 12px;
    color: var(--app-text-2);
  }

  .mode-preview {
    position: relative;
    display: block;
    width: 56px;
    height: 38px;
    overflow: hidden;
    border-radius: 7px;
    background: color-mix(in srgb, var(--app-text-3) 7%, transparent);
  }

  .pv-side,
  .pv-head,
  .pv-body,
  .pv-nav {
    position: absolute;
    background: color-mix(in srgb, var(--app-text-3) 26%, transparent);
    border-radius: 2px;
    transition: all var(--app-dur) var(--app-ease);
  }

  .pv-side {
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: 11px;
  }

  .pv-head {
    top: 4px;
    right: 4px;
    left: 19px;
    height: 7px;
  }

  .pv-body {
    top: 15px;
    right: 4px;
    bottom: 4px;
    left: 19px;
  }

  .mode.is-top {
    .pv-side {
      width: 0;
      opacity: 0;
    }

    .pv-head,
    .pv-body {
      left: 4px;
    }
  }

  .mode.is-mix {
    .pv-side {
      top: 15px;
    }

    .pv-head {
      left: 4px;
    }
  }

  .setting-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 11px;
    border: 1px solid color-mix(in srgb, var(--app-text-3) 16%, transparent);
    border-radius: var(--app-radius-sm);
    background: color-mix(in srgb, var(--app-text-3) 4%, transparent);
    color: var(--app-text-2);
    font-size: 12.5px;
    cursor: pointer;
    transition:
      border-color var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease);

    &:hover {
      color: var(--app-text);
      border-color: color-mix(in srgb, var(--app-primary) 34%, transparent);
    }

    &.is-active {
      color: var(--app-primary);
      font-weight: 600;
      border-color: color-mix(in srgb, var(--app-primary) 46%, transparent);
      background: color-mix(in srgb, var(--app-primary) 12%, transparent);
    }
  }

  .setting-colors {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .color {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    background: var(--swatch);
    cursor: pointer;
    transition:
      transform var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease);

    &:hover {
      transform: scale(1.12);
    }

    &.is-active {
      box-shadow:
        0 0 0 2px var(--app-surface),
        0 0 0 4px var(--swatch);
    }
  }

  /* el-color-picker 默认触发器是「4px 圆角方块 + 1px 灰描边 + 4px 内边距」，
     里面再套一层带描边和 8px 圆角的 __color，右下还压一个白色向下箭头图标，
     和左边 24px 的圆形色板完全不是一个形状。这里把它改成同款正圆：
     去掉描边和内边距，色块铺满并裁圆，隐藏箭头图标，hover 缩放保持一致 */
  .setting-colors :deep(.el-color-picker) {
    width: 24px;
    height: 24px;
    line-height: 0;

    .el-color-picker__trigger {
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      transition: transform var(--app-dur) var(--app-ease);

      &:hover {
        transform: scale(1.12);
      }
    }

    .el-color-picker__color {
      width: 100%;
      height: 100%;
      overflow: hidden;
      border: 0;
      border-radius: 50%;
    }

    .el-color-picker__color-inner {
      border-radius: 50%;
    }

    .el-color-picker__icon,
    .el-color-picker__empty {
      display: none;
    }
  }

  .setting-switches {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
  }

  .switch-text {
    font-size: 13px;
    color: var(--app-text-2);
  }

  .setting-divider {
    margin: 0;
  }

  .setting-reset {
    width: 100%;
  }

  .setting-tip {
    margin: -6px 0 0;
    font-size: 11px;
    text-align: center;
    color: var(--app-text-3);
  }
</style>
