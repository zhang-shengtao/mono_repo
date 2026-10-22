<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown, Expand, Fold, SwitchButton, User } from "@element-plus/icons-vue";
import { resetMenuRoutes } from "@/router/menu-routes";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import { formatDateTime } from "@/utils/format";
import Breadcrumbs from "./Breadcrumbs.vue";

const appStore = useAppStore();
const auth = useAuthStore();
const router = useRouter();

const profileVisible = ref(false);

async function handleLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm("退出后需要重新登录才能继续操作，确定退出吗？", "退出登录", {
      type: "warning",
      confirmButtonText: "退出登录",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  await auth.logout();
  resetMenuRoutes();
  await router.replace({ name: "Login" });
  ElMessage.success("已退出登录");
}

function handleCommand(command: string): void {
  if (command === "profile") profileVisible.value = true;
  if (command === "logout") void handleLogout();
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__action" role="button" title="折叠 / 展开侧边栏" @click="appStore.toggleCollapsed()">
      <el-icon :size="18">
        <Expand v-if="appStore.collapsed" />
        <Fold v-else />
      </el-icon>
    </div>

    <Breadcrumbs />

    <div class="app-header__spacer" />

    <el-tag v-if="auth.menuSource === 'builtin'" type="warning" effect="plain" size="small">内置菜单</el-tag>

    <el-dropdown trigger="click" @command="handleCommand">
      <div class="app-user">
        <div class="app-user__avatar">{{ auth.avatarText }}</div>
        <div class="app-user__meta">
          <span class="app-user__name">{{ auth.displayName }}</span>
          <span class="app-user__role">{{ auth.roleLabel }}</span>
        </div>
        <el-icon :size="12"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="profile" :icon="User">个人信息</el-dropdown-item>
          <el-dropdown-item command="logout" :icon="SwitchButton" divided>退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </header>

  <el-dialog v-model="profileVisible" title="个人信息" width="460px">
    <el-descriptions :column="1" border>
      <el-descriptions-item label="账号">{{ auth.profile?.account ?? "-" }}</el-descriptions-item>
      <el-descriptions-item label="昵称">{{ auth.profile?.nickname ?? "-" }}</el-descriptions-item>
      <el-descriptions-item label="角色">{{ auth.roleLabel }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{
        auth.profile?.status === "normal" ? "正常" : "已禁用"
      }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ formatDateTime(auth.profile?.created_at) }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{ auth.profile?.remark || "-" }}</el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button type="primary" @click="profileVisible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>
