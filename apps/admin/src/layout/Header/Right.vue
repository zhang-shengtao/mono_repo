<script setup lang="ts">
  /**
   * 顶栏右区：搜索(Ctrl+K) / 全屏 / 明暗 / 材质 / 设置 / 用户下拉
   */
  import { ElMessage } from "element-plus";
  import layout from "@/layout";

  defineOptions({ name: "HeaderRight" });

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const avatarText = computed(() => layout.userInfo.name.slice(0, 1) || "U");

  const materialTip = computed(() => (layout.settings.material === "glass" ? "切换纯色材质" : "切换玻璃材质"));

  function onUserCommand(command: string | number | object) {
    if (command === "setting" || command === "appearance") {
      layout.openSetting();
      return;
    }
    if (command === "logout") {
      // 登录模块下一轮接入
      ElMessage.info("登录模块下一轮接入");
    }
  }
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5">
    <el-tooltip content="搜索菜单 (Ctrl + K)" placement="bottom">
      <el-button text circle @click="layout.openCommand()">
        <MyIcon name="Search" :size="18" />
      </el-button>
    </el-tooltip>

    <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
      <el-button text circle @click="toggleFullscreen()">
        <MyIcon :name="isFullscreen ? 'Aim' : 'FullScreen'" :size="18" />
      </el-button>
    </el-tooltip>

    <el-tooltip :content="layout.isDark ? '切换到浅色' : '切换到深色'" placement="bottom">
      <el-button text circle @click="layout.toggleTheme()">
        <MyIcon :name="layout.isDark ? 'Sunny' : 'Moon'" :size="18" />
      </el-button>
    </el-tooltip>

    <el-tooltip :content="materialTip" placement="bottom">
      <el-button text circle @click="layout.toggleMaterial()">
        <MyIcon :name="layout.settings.material === 'glass' ? 'MagicStick' : 'Grid'" :size="18" />
      </el-button>
    </el-tooltip>

    <el-tooltip content="外观设置" placement="bottom">
      <el-button text circle @click="layout.openSetting()">
        <MyIcon name="Setting" :size="18" />
      </el-button>
    </el-tooltip>

    <el-dropdown trigger="click" @command="onUserCommand">
      <div class="ml-1 flex cursor-pointer items-center gap-2 rounded-btn px-1.5 py-1 transition-colors hover:bg-[color-mix(in_srgb,var(--app-primary)_10%,transparent)]">
        <el-avatar :size="26" class="shrink-0 bg-gradient-to-br from-[#6366f1] to-[#22d3ee] text-[12px]">
          {{ avatarText }}
        </el-avatar>
        <span class="hidden max-w-[92px] truncate text-[13px] text-ink md:inline">{{ layout.userInfo.name }}</span>
        <MyIcon name="ArrowDown" :size="12" color="var(--app-text-3)" />
      </div>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="setting">系统设置</el-dropdown-item>
          <el-dropdown-item command="appearance">外观设置</el-dropdown-item>
          <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
