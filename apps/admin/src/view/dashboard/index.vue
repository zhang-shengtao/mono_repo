<script setup lang="ts">
  /**
   * 工作台占位页
   *
   * name 必须与 route.name 完全一致，否则 keep-alive 静默失效。
   * 这里不 import @/layout —— 业务页不碰布局内部。
   */
  defineOptions({ name: "dashboard" });

  const router = useRouter();

  const stats = [
    { label: "今日访问", value: "1,284", tip: "占位数据" },
    { label: "在线用户", value: "36", tip: "占位数据" },
    { label: "待处理工单", value: "12", tip: "占位数据" },
    { label: "本月增长", value: "+18.6%", tip: "占位数据" },
  ];

  const entries = [
    { title: "用户管理", icon: "User", path: "/system/user" },
    { title: "系统设置", icon: "Tools", path: "/system/setting" },
    { title: "仪表盘", icon: "Odometer", path: "/dashboard" },
    { title: "命令面板", icon: "Search", path: "" },
  ];

  function onEntry(path: string) {
    if (path) router.push(path);
  }

  const text = ref("");
</script>

<template>
  <div style="height: 100%">
    <el-input v-model="text"></el-input>
  </div>
</template>
