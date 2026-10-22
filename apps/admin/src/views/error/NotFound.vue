<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const path = computed(() => route.fullPath);
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <div class="error-card__code">404</div>
      <h1 class="error-card__title">页面不存在</h1>
      <p class="error-card__desc">
        访问的地址没有匹配到任何页面菜单。<br />
        如果这是刚配置的菜单，请确认「菜单管理」里的路由路径与前端组件一致。
      </p>
      <p class="muted mono" style="margin-bottom: 24px">{{ path }}</p>
      <el-space>
        <el-button @click="router.back()">返回上一页</el-button>
        <el-button type="primary" @click="router.replace('/dashboard')">回到仪表盘</el-button>
      </el-space>
    </div>
  </div>
</template>
