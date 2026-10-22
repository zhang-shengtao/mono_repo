<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <div class="error-card__code">403</div>
      <h1 class="error-card__title">没有访问权限</h1>
      <p class="error-card__desc">
        当前账号没有被分配这个页面的权限。请联系上级管理员在「用户管理 → 权限」里分配对应菜单后重试。
      </p>
      <el-space>
        <el-button @click="router.back()">返回上一页</el-button>
        <el-button type="primary" @click="router.replace('/dashboard')">回到仪表盘</el-button>
      </el-space>
    </div>
  </div>
</template>
