<script setup lang="ts">
/**
 * 菜单配置了页面，但前端没有对应组件时的兜底页。
 * 好处：管理员可以先在后台把菜单树搭好，前端这个页面不会白屏，也不会 404。
 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";

const route = useRoute();
const title = computed(() => String(route.meta.title ?? "页面"));

const registryKeys = ["system/user", "system/menu", "system/code", "dashboard"];
</script>

<template>
  <div class="page">
    <PageHeader :title="title" description="菜单已存在，但前端还没有对应的视图组件" />

    <div class="card card--pad">
      <el-result icon="warning" title="页面组件未实现" sub-title="这条菜单能正常出现在侧边栏，但渲染时找不到组件。">
        <template #extra>
          <div class="muted mono">{{ route.path }}</div>
        </template>
      </el-result>

      <el-descriptions :column="1" border title="怎么修">
        <el-descriptions-item label="方式一">
          把菜单的 meta.component 填成内置组件键，可选值：{{ registryKeys.join("、") }}（也支持 system/user/index 这类带
          /index 的路径键）
        </el-descriptions-item>
        <el-descriptions-item label="方式二">
          让路由路径和内置组件键对上，例如 /system/user 会自动命中 system/user
        </el-descriptions-item>
        <el-descriptions-item label="方式三">
          在 apps/admin/src/router/routes.ts 的 pageRegistry 里注册新的视图组件
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>
