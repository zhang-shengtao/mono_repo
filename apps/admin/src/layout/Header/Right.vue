<script setup lang="ts">
  defineOptions({ name: "LayoutHeaderRight" });
  const router = useRouter();

  import layoutData from "@/layout";

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const avatarText = computed(() => layoutData.userInfo.name.slice(0, 1) || "U");

  interface HeaderAction {
    key: string;
    icon: string;
    tip: string;
    run: () => void;
  }

  const allActions = computed<HeaderAction[]>(() => [
    {
      key: "search",
      icon: "Search",
      tip: "搜索菜单 (Ctrl + K)",
      run: () => {
        layoutData.commandOpen = true;
      },
    },
    {
      key: "fullscreen",
      icon: isFullscreen.value ? "Aim" : "FullScreen",
      tip: isFullscreen.value ? "退出全屏" : "全屏",
      run: () => toggleFullscreen(),
    },
    {
      key: "theme",
      icon: layoutData.isDark ? "Sunny" : "Moon",
      tip: layoutData.isDark ? "切换到浅色" : "切换到深色",
      run: () => {
        layoutData.theme = layoutData.isDark ? "light" : "dark";
      },
    },
    {
      key: "material",
      icon: layoutData.material === "glass" ? "MagicStick" : "Grid",
      tip: layoutData.material === "glass" ? "切换纯色材质" : "切换玻璃材质",
      run: () => {
        layoutData.material = layoutData.material === "glass" ? "solid" : "glass";
      },
    },
    {
      key: "setting",
      icon: "Setting",
      tip: "外观设置",
      run: () => {
        layoutData.isSettingOpen = true;
      },
    },
  ]);

  const actions = computed(() => (layoutData.isMobile ? allActions.value.filter((item) => item.key === "search") : allActions.value));

  function onCommand(command: string | number | object) {
    if (command === "setting" || command === "appearance") layoutData.isSettingOpen = true;

    if (command === "logout") {
      router.replace("/login");
    }
  }
</script>

<template>
  <div class="header-right">
    <el-tooltip v-for="action in actions" :key="action.key" :content="action.tip" placement="bottom" :show-after="360">
      <button type="button" class="app-icon-btn" @click="action.run()">
        <MyIcon :name="action.icon" :size="18" />
      </button>
    </el-tooltip>

    <span class="header-divider" aria-hidden="true" />

    <el-dropdown trigger="click" @command="onCommand">
      <button type="button" class="header-user">
        <el-avatar :size="24" class="header-avatar">{{ avatarText }}</el-avatar>
        <span class="header-user-name">{{ layoutData.userInfo.name }}</span>
        <MyIcon name="ArrowDown" :size="12" color="var(--app-text-3)" />
      </button>

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

<style lang="scss" scoped>
  .header-right {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }

  .header-divider {
    width: 1px;
    height: 16px;
    margin: 0 6px;
    background-color: color-mix(in srgb, var(--app-text-3) 22%, transparent);
  }

  .header-user {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 7px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    cursor: pointer;
    transition:
      background-color var(--app-dur) var(--app-ease),
      border-color var(--app-dur) var(--app-ease);

    &:hover {
      border-color: color-mix(in srgb, var(--app-primary) 22%, transparent);
      background-color: color-mix(in srgb, var(--app-primary) 8%, transparent);
    }
  }

  .header-avatar {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    background-image: linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 45%, #22d3ee));
  }

  .header-user-name {
    max-width: 92px;
    overflow: hidden;
    font-size: 13px;
    color: var(--app-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .header-user-name {
      display: none;
    }

    .header-divider {
      display: none;
    }
  }
</style>
