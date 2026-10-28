<script setup lang="ts">
  /**
   * 外观设置抽屉（抽屉壳 + 面板内容同一个文件）
   *
   * 选项枚举与主题色预设只被这里使用，所以按「UI 枚举下沉」的规则放在本文件。
   * 写入统一走 layout.settings（useStorage 持久化 + deep watch 实时应用主题）。
   */
  import { ElMessage } from "element-plus";
  import layout from "@/layout";

  defineOptions({ name: "LayoutSetting" });

  const COLOR_PRESETS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

  const PAGE_STYLE_OPTIONS = [
    { value: "zoom", label: "缩放淡入" },
    { value: "fadeIn", label: "纯淡入" },
    { value: "3D", label: "3D 翻转" },
    { value: "none", label: "无动效" },
  ] as const;

  function onColorChange(value: string | null) {
    if (!value) return;
    layout.setPrimaryColor(value);
  }

  function reset() {
    layout.resetLayout();
    ElMessage.success("已恢复默认布局");
  }
</script>

<template>
  <el-drawer v-model="layout.isSettingOpen" title="外观设置" direction="rtl" size="340px" :z-index="3500">
    <!-- 布局模式 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">布局模式</p>
      <el-radio-group v-model="layout.settings.layoutStyle" size="small">
        <el-radio-button value="side">侧栏</el-radio-button>
        <el-radio-button value="top">顶部</el-radio-button>
        <el-radio-button value="mix">混合</el-radio-button>
      </el-radio-group>
    </section>

    <!-- 明暗 / 侧栏明暗 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">主题模式</p>
      <el-radio-group v-model="layout.settings.theme" size="small">
        <el-radio-button value="light">浅色</el-radio-button>
        <el-radio-button value="dark">深色</el-radio-button>
      </el-radio-group>
    </section>

    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">侧栏明暗</p>
      <el-radio-group v-model="layout.settings.sidebarTheme" size="small">
        <el-radio-button value="light">浅色玻璃</el-radio-button>
        <el-radio-button value="dark">深色玻璃</el-radio-button>
      </el-radio-group>
    </section>

    <!-- 主题色 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">主题色</p>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="color in COLOR_PRESETS"
          :key="color"
          type="button"
          class="size-6 cursor-pointer rounded-full border-2 border-solid transition-transform hover:scale-110"
          :style="{
            backgroundColor: color,
            borderColor: layout.settings.primaryColor === color ? 'var(--app-text)' : 'transparent',
          }"
          @click="layout.setPrimaryColor(color)"
        />
        <el-color-picker :model-value="layout.settings.primaryColor" size="small" @change="onColorChange" />
      </div>
    </section>

    <!-- 材质 / 密度 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">视觉材质</p>
      <el-radio-group v-model="layout.settings.material" size="small">
        <el-radio-button value="glass">渐变玻璃</el-radio-button>
        <el-radio-button value="solid">纯色</el-radio-button>
      </el-radio-group>
    </section>

    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">内容宽度</p>
      <el-radio-group v-model="layout.settings.contentWidth" size="small">
        <el-radio-button value="fluid">流式</el-radio-button>
        <el-radio-button value="boxed">定宽</el-radio-button>
      </el-radio-group>
    </section>

    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">密度</p>
      <el-radio-group v-model="layout.settings.density" size="small">
        <el-radio-button value="comfortable">舒适</el-radio-button>
        <el-radio-button value="compact">紧凑</el-radio-button>
      </el-radio-group>
    </section>

    <!-- 页面动效 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">页面切换动效</p>
      <el-select v-model="layout.settings.switchPageStyle" size="small" class="w-full">
        <el-option v-for="item in PAGE_STYLE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </section>

    <!-- 元素开关 -->
    <section class="mb-5">
      <p class="mb-2 text-[12.5px] font-medium text-ink-2">元素显示</p>
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-ink-2">面包屑</span>
          <el-switch v-model="layout.settings.isShowBreadcrumbs" size="small" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-ink-2">多页签</span>
          <el-switch v-model="layout.settings.isShowTabs" size="small" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[13px] text-ink-2">Logo</span>
          <el-switch v-model="layout.settings.isShowLogo" size="small" />
        </div>
        <div v-if="!layout.isMobile" class="flex items-center justify-between">
          <span class="text-[13px] text-ink-2">侧栏折叠</span>
          <el-switch v-model="layout.settings.isCollapse" size="small" />
        </div>
      </div>
    </section>

    <el-divider class="my-4" />

    <el-button class="w-full" size="small" @click="reset">恢复默认</el-button>

    <p class="mt-3 text-center text-[11px] text-ink-3">设置会自动保存在本地</p>
  </el-drawer>
</template>
