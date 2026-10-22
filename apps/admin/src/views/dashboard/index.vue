<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Component } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Menu as MenuIcon, Key, Refresh, Setting, User, UserFilled } from "@element-plus/icons-vue";
import { codeApi } from "@/api/code";
import { globalApi, type HealthResult } from "@/api/global";
import { menuApi } from "@/api/menu";
import { userApi } from "@/api/user";
import { useAuthStore } from "@/stores/auth";
import { countMenus } from "@/utils/menu";
import { formatDateTime } from "@/utils/format";

const auth = useAuthStore();
const router = useRouter();

const childTotal = ref<number | null>(null);
const menuTotal = ref<number | null>(null);
const codeTotal = ref<number | null>(null);
const health = ref<HealthResult | null>(null);
const aiName = ref("-");
const loading = ref(false);

const today = new Intl.DateTimeFormat("zh-CN", { dateStyle: "full" }).format(new Date());

const stats = computed<Array<{ key: string; label: string; value: number | null; icon: Component; hint: string }>>(
  () => [
    { key: "children", label: "直属子账号", value: childTotal.value, icon: User, hint: "当前账号下的直接下级" },
    { key: "menus", label: "菜单节点", value: menuTotal.value, icon: MenuIcon, hint: "目录 + 页面 + 按钮" },
    { key: "codes", label: "权限码", value: codeTotal.value, icon: Key, hint: "code 表记录总数" },
  ],
);

const quickLinks = computed(() =>
  [
    {
      title: "用户管理",
      desc: "维护直属子账号与权限",
      path: "/system/user",
      permission: "system:user:get",
      icon: UserFilled,
    },
    {
      title: "菜单管理",
      desc: "维护目录 / 页面 / 按钮",
      path: "/system/menu",
      permission: "system:menu:get",
      icon: MenuIcon,
    },
    {
      title: "权限码",
      desc: "启停权限码、查看绑定",
      path: "/system/code",
      permission: "system:code:get",
      icon: Setting,
    },
  ].filter((item) => auth.can(item.permission)),
);

async function loadStats(): Promise<void> {
  loading.value = true;
  try {
    if (auth.can("system:user:get")) {
      const result = await userApi.list({ page: 1, limit: 1, search: "", status: "all" });
      childTotal.value = result.total;
    }
    if (auth.can("system:menu:get")) {
      const result = await menuApi.list("");
      menuTotal.value = countMenus(result.list);
    } else {
      // 没有菜单管理权限时，至少能统计自己可见的菜单
      menuTotal.value = countMenus(auth.menus);
    }
    if (auth.can("system:code:get")) {
      const result = await codeApi.list({ page: 1, limit: 1, search: "", is_disabled: "all" });
      codeTotal.value = result.total;
    }
  } catch {
    // 单个接口失败不影响其它卡片，拦截器已经提示过
  } finally {
    loading.value = false;
  }
}

async function loadHealth(): Promise<void> {
  try {
    health.value = await globalApi.ready();
  } catch {
    health.value = null;
  }
  try {
    const detail = await globalApi.aiDetail();
    aiName.value = detail.name;
  } catch {
    aiName.value = "-";
  }
}

async function refresh(): Promise<void> {
  await Promise.all([loadStats(), loadHealth()]);
  ElMessage.success("数据已刷新");
}

function go(path: string): void {
  void router.push(path);
}

onMounted(() => {
  void loadStats();
  void loadHealth();
});
</script>

<template>
  <div class="page">
    <section class="welcome-card">
      <div>
        <h2 class="welcome-card__title">你好，{{ auth.displayName }}</h2>
        <p class="welcome-card__desc">欢迎回到管理后台，这里汇总了账号、菜单与权限配置的概况。</p>
        <div class="welcome-card__meta">
          <span class="welcome-card__chip">{{ auth.roleLabel }}</span>
          <span class="welcome-card__chip">账号：{{ auth.profile?.account ?? "-" }}</span>
          <span class="welcome-card__chip">
            菜单来源：{{ auth.menuSource === "builtin" ? "内置菜单（数据库未配置）" : "数据库菜单" }}
          </span>
          <span class="welcome-card__chip">{{ today }}</span>
        </div>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="refresh">刷新数据</el-button>
    </section>

    <el-alert v-if="auth.menuSource === 'builtin'" type="warning" show-icon :closable="false">
      <template #title>当前使用的是内置菜单</template>
      <div>
        admin_menus 表里还没有页面记录，侧边栏暂时用内置菜单兜底。到
        <router-link to="/system/menu">菜单管理</router-link>
        按「目录 → 页面 → 按钮」建好菜单后，一切以数据库配置为准。
      </div>
    </el-alert>

    <div class="stat-grid">
      <div v-for="item in stats" :key="item.key" class="stat-card">
        <div class="stat-card__icon">
          <el-icon><component :is="item.icon" /></el-icon>
        </div>
        <div>
          <div class="stat-card__label">{{ item.label }}</div>
          <div class="stat-card__value">{{ item.value === null ? "—" : item.value.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <div class="dashboard-columns">
      <section class="card">
        <div class="card__header">
          <h3 class="card__title">系统状态</h3>
          <el-tag :type="health ? 'success' : 'danger'" size="small" effect="plain">
            {{ health ? "运行中" : "不可用" }}
          </el-tag>
        </div>
        <div class="card__body status-list">
          <div class="status-row">
            <span class="status-row__label">Redis</span>
            <span class="mono">{{ health?.redis ?? "—" }}</span>
          </div>
          <div class="status-row">
            <span class="status-row__label">PostgreSQL</span>
            <span class="mono">{{ health?.database ?? "—" }}</span>
          </div>
          <div class="status-row">
            <span class="status-row__label">服务时间</span>
            <span class="mono">{{ health ? formatDateTime(new Date(health.uptime).toISOString()) : "—" }}</span>
          </div>
          <div class="status-row">
            <span class="status-row__label">AI 示例接口</span>
            <span class="mono">{{ aiName }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card__header">
          <h3 class="card__title">快捷入口</h3>
        </div>
        <div class="card__body">
          <div v-if="quickLinks.length === 0" class="muted">当前账号没有可用的管理页面</div>
          <div v-else class="quick-grid">
            <div v-for="item in quickLinks" :key="item.path" class="quick-card" @click="go(item.path)">
              <el-icon :size="18" class="stat-card__icon" style="width: 34px; height: 34px">
                <component :is="item.icon" />
              </el-icon>
              <div>
                <div class="quick-card__title">{{ item.title }}</div>
                <div class="quick-card__desc">{{ item.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
