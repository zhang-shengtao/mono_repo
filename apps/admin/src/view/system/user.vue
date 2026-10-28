<script setup lang="ts">
  /**
   * 用户管理占位页（自带页头骨架）
   * name 必须与 route.name 一致，否则 keep-alive 静默失效。
   */
  defineOptions({ name: "systemUser" });

  const columns = [
    { prop: "name", label: "姓名", width: 160 },
    { prop: "account", label: "账号", width: 160 },
    { prop: "role", label: "角色", width: 140 },
    { prop: "status", label: "状态", width: 120 },
  ];

  const rows = [
    { name: "管理员", account: "admin", role: "超级管理员", status: "启用" },
    { name: "运营", account: "operator", role: "运营", status: "启用" },
  ];
</script>

<template>
  <div class="flex flex-col gap-[var(--app-gap)]">
    <header>
      <h1 class="m-0 text-[22px] font-semibold tracking-tight text-ink">用户管理</h1>
      <p class="mt-1 text-[13px] text-ink-3">占位页：表格区用实体面（不用玻璃），保证可读性。</p>
    </header>

    <section class="app-card p-5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[16px] font-semibold text-ink">用户列表</h2>
        <el-button size="small" type="primary">新增用户</el-button>
      </div>

      <el-table :data="rows" size="small">
        <el-table-column v-for="column in columns" :key="column.prop" :prop="column.prop" :label="column.label" :width="column.width" />
      </el-table>
    </section>
  </div>
</template>
