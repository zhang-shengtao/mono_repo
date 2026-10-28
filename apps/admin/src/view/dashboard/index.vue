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
</script>

<template>
  <div class="flex flex-col gap-[var(--app-gap)]">
    <header>
      <h1 class="m-0 text-[22px] font-semibold tracking-tight text-ink">仪表盘</h1>
      <p class="mt-1 text-[13px] text-ink-3">布局骨架已就位，本页只做视觉占位；真实数据下一轮接接口。</p>
    </header>

    <div class="grid grid-cols-1 gap-[var(--app-gap)] sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="item in stats" :key="item.label" class="app-card p-5">
        <p class="text-[12.5px] text-ink-3">{{ item.label }}</p>
        <p class="app-gradient-text mt-2 text-[30px] font-semibold leading-none tabular-nums">{{ item.value }}</p>
        <p class="mt-2 text-[12px] text-ink-3">{{ item.tip }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-[var(--app-gap)] lg:grid-cols-3">
      <section class="app-card p-5 lg:col-span-2">
        <h2 class="m-0 text-[16px] font-semibold text-ink">快捷入口</h2>
        <p class="mt-1 text-[12.5px] text-ink-3">验证二级菜单、页签与 keep-alive</p>

        <div class="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <button
            v-for="entry in entries"
            :key="entry.title"
            type="button"
            class="flex cursor-pointer flex-col items-center gap-1.5 rounded-inner border border-glass-border bg-[color-mix(in_srgb,var(--app-primary)_5%,transparent)] px-2 py-4 text-[12.5px] text-ink-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--app-primary)_38%,transparent)] hover:text-primary"
            @click="onEntry(entry.path)"
          >
            <MyIcon :name="entry.icon" :size="20" />
            <span>{{ entry.title }}</span>
          </button>
        </div>
      </section>

      <section class="app-card p-5">
        <h2 class="m-0 text-[16px] font-semibold text-ink">待办</h2>
        <el-empty description="暂无内容（占位）" :image-size="72" />
      </section>
    </div>
  </div>
</template>
