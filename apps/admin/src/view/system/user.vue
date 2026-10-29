<script setup lang="ts">
  /**
   * 用户管理占位页（自带页头骨架）
   * name 必须与 route.name 一致，否则 keep-alive 静默失效。
   */
  defineOptions({ name: "systemUser" });

  const columns = [
    { prop: "name", label: "姓名" },
    { prop: "account", label: "账号" },
    { prop: "role", label: "角色" },
    { prop: "status", label: "状态" },
  ];

  const rows = [
    { name: "管理员", account: "admin", role: "超级管理员", status: "启用" },
    { name: "运营", account: "operator", role: "运营", status: "启用" },
  ];
</script>

<template>
  <el-table :data="rows" size="small" border>
    <el-table-column v-for="column in columns" :key="column.prop" :prop="column.prop" :label="column.label" :width="column.width" />
  </el-table>
</template>
