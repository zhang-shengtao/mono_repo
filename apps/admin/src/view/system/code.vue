<script setup lang="ts">
  import type { CodeItem } from "@repo/shared";
  import { fetchCodeList, updateCode } from "@/api/code";
  defineOptions({ name: "systemCode" });

  type BaseColumn = InstanceType<GlobalComponents["MyTable"]>["$props"]["columns"][number];
  type TableColumn<Row> = Omit<BaseColumn, "children" | "prop" | "formatter"> & {
    children?: TableColumn<Row>[];
    prop?: string | ((scope: { row: Row; column: any; $index: number }) => unknown);
    formatter?: (scope: { row: Row; column: any; $index: number }) => unknown;
  };

  type StatusFilter = "" | "enabled" | "disabled";

  const STATUS_OPTIONS: { value: Exclude<StatusFilter, "">; label: string }[] = [
    { value: "enabled", label: "启用中" },
    { value: "disabled", label: "已禁用" },
  ];

  /** 权限码最长 26 个字符，列宽按内容给；备注 / 绑定菜单留够展示空间，窄屏横向滚动查看 */
  const columns: TableColumn<CodeItem>[] = [
    { label: "权限码", slot: "code", width: 220 },
    { label: "名称", slot: "name", minWidth: 120 },
    { label: "作用域", slot: "scope", width: 96 },
    { label: "备注", slot: "description", minWidth: 210 },
    { label: "绑定菜单", slot: "bind", minWidth: 140 },
    { label: "更新时间", slot: "updated", width: 132 },
    { label: "状态", slot: "status", width: 118 },
    { label: "操作", slot: "action", width: 96 },
  ];

  // ---------------- 列表 ----------------
  const loading = ref(false);
  const codes = ref<CodeItem[]>([]);
  const keyword = ref("");
  const scopeFilter = ref("");
  const statusFilter = ref<StatusFilter>("");
  const statusBusy = reactive(new Set<string>());

  /**
   * 权限码是随代码种子维护的有限集合（几十条），一次拉全量、本地过滤：
   * 搜索 / 作用域 / 状态切换都不用再打接口，统计数字也不会随筛选条件变形。
   * 服务端仍支持 keyword / scope / is_disabled 过滤，供其他调用方按需使用。
   */
  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    return codes.value.filter((item) => {
      if (scopeFilter.value && item.scope !== scopeFilter.value) return false;
      if (statusFilter.value === "enabled" && item.is_disabled) return false;
      if (statusFilter.value === "disabled" && !item.is_disabled) return false;
      if (!kw) return true;
      return [item.code, item.name, item.description ?? "", item.bind_menu_title ?? ""].some((value) => value.toLowerCase().includes(kw));
    });
  });

  const scopeOptions = computed(() => [...new Set(codes.value.map((item) => item.scope))].sort((a, b) => a.localeCompare(b)));

  const stats = computed(() => {
    const total = codes.value.length;
    const disabled = codes.value.filter((item) => item.is_disabled).length;
    return {
      total,
      disabled,
      enabled: total - disabled,
      bound: codes.value.filter((item) => item.bind_menu_id !== null).length,
    };
  });

  const hasFilter = computed(() => Boolean(keyword.value.trim() || scopeFilter.value || statusFilter.value));

  function resetFilters() {
    keyword.value = "";
    scopeFilter.value = "";
    statusFilter.value = "";
  }

  async function loadList() {
    loading.value = true;
    try {
      codes.value = (await fetchCodeList()).list;
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false;
    }
  }

  // ---------------- 启用 / 禁用 ----------------
  /**
   * 行内启停：直接改 code.is_disabled。
   * 禁用会让持有该权限的账号立刻调不通对应接口，所以先确认；已绑定菜单时把菜单名字写进提示，
   * 方便管理员判断影响面（绑定关系本身不受影响，重新启用即复原）。
   */
  async function toggleStatus(row: CodeItem, enabled: boolean) {
    if (statusBusy.has(row.code)) return;

    if (!enabled) {
      const target = row.bind_menu_id !== null ? `该权限码已绑定菜单「${row.bind_menu_title ?? row.bind_menu_id}」，` : "";
      try {
        await ElMessageBox.confirm(`${target}禁用后持有该权限的账号将无法调用对应接口。确定禁用「${row.name}」吗？`, "禁用确认", {
          type: "warning",
          confirmButtonText: "禁用",
          cancelButtonText: "取消",
        });
      } catch {
        return;
      }
    }

    statusBusy.add(row.code);
    try {
      const updated = await updateCode({ code: row.code, is_disabled: !enabled });
      Object.assign(row, updated);
      ElMessage.success(enabled ? "已启用" : "已禁用");
    } catch {
      // 请求层已统一提示，开关保持原状态
    } finally {
      statusBusy.delete(row.code);
    }
  }

  // ---------------- 备注 ----------------
  const remarkVisible = ref(false);
  const remarkSaving = ref(false);
  const remarkRow = ref<CodeItem | null>(null);
  const remarkText = ref("");

  function openRemark(row: CodeItem) {
    remarkRow.value = row;
    remarkText.value = row.description ?? "";
    remarkVisible.value = true;
  }

  async function saveRemark() {
    if (!remarkRow.value) return;

    remarkSaving.value = true;
    try {
      const description = remarkText.value.trim();
      const updated = await updateCode({ code: remarkRow.value.code, description: description || null });
      Object.assign(remarkRow.value, updated);
      ElMessage.success(description ? "备注已保存" : "备注已清空");
      remarkVisible.value = false;
    } catch {
      // 请求层已统一提示，弹窗保持打开方便修改
    } finally {
      remarkSaving.value = false;
    }
  }

  function handleRemarkClosed() {
    remarkRow.value = null;
    remarkText.value = "";
  }

  // ---------------- 复制 ----------------
  const { copy, isSupported: copySupported } = useClipboard({ legacy: true });

  async function copyCode(row: CodeItem) {
    if (!row.code) return;
    if (!copySupported.value) {
      ElMessage.warning("当前浏览器不支持自动复制，请手动选中复制");
      return;
    }
    try {
      await copy(row.code);
      ElMessage.success(`已复制 ${row.code}`);
    } catch {
      ElMessage.error("复制失败，请手动选中复制");
    }
  }

  // ---------------- 展示辅助 ----------------
  /** 库里是 timestamp 字符串（2026-11-02 17:02:28.123），表格只显示到分钟 */
  function formatTime(value?: string | null) {
    if (!value) return "—";
    return String(value).replace("T", " ").slice(0, 16);
  }

  function bindTitle(row: { bind_menu_id?: number | null; bind_menu_title?: string | null }) {
    if (row.bind_menu_id === null || row.bind_menu_id === undefined) return "";
    return row.bind_menu_title ?? `菜单 ${row.bind_menu_id}`;
  }

  onMounted(() => {
    void loadList();
  });
</script>

<template>
  <div class="code-page">
    <header class="code-head">
      <div>
        <h1 class="code-title">权限码管理</h1>
        <p class="code-desc">权限码由后端 permissions 种子维护，新增 / 改名随代码走，这里只读。</p>
        <p class="code-desc">可维护备注、启用或禁用某个接口；禁用后持有该权限的账号会立刻失去对应接口的访问权限（超级管理员除外）。</p>
      </div>

      <div class="code-toolbar">
        <el-input v-model="keyword" class="toolbar-search" clearable placeholder="权限码 / 名称 / 备注">
          <template #prefix><my-icon name="Search" :size="14" /></template>
        </el-input>

        <el-select v-model="scopeFilter" class="toolbar-select" clearable placeholder="全部作用域">
          <el-option v-for="scope in scopeOptions" :key="scope" :label="scope" :value="scope" />
        </el-select>

        <el-select v-model="statusFilter" class="toolbar-select" clearable placeholder="全部状态">
          <el-option v-for="item in STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-button v-if="hasFilter" text @click="resetFilters">清空筛选</el-button>

        <el-button :loading="loading" @click="loadList">
          <my-icon name="Refresh" :size="14" class="btn-icon" />
          刷新
        </el-button>
      </div>
    </header>

    <section class="code-stats">
      <article class="stat">
        <div class="stat-head">
          <my-icon name="Key" :size="14" class="stat-icon" />
          <span class="stat-label">权限码总数</span>
        </div>
        <strong class="stat-value">{{ stats.total }}</strong>
      </article>
      <article class="stat stat--success">
        <div class="stat-head">
          <my-icon name="CircleCheck" :size="14" class="stat-icon" />
          <span class="stat-label">启用中</span>
        </div>
        <strong class="stat-value">{{ stats.enabled }}</strong>
      </article>
      <article class="stat stat--danger">
        <div class="stat-head">
          <my-icon name="CircleClose" :size="14" class="stat-icon" />
          <span class="stat-label">已禁用</span>
        </div>
        <strong class="stat-value">{{ stats.disabled }}</strong>
      </article>
      <article class="stat stat--primary">
        <div class="stat-head">
          <my-icon name="Link" :size="14" class="stat-icon" />
          <span class="stat-label">已绑定菜单</span>
        </div>
        <strong class="stat-value">{{ stats.bound }}</strong>
      </article>
    </section>

    <my-table v-loading="loading" :data="rows" :columns="columns" row-key="code" size="small" border>
      <template #code="{ row }">
        <el-tooltip v-if="row.code" content="点击复制权限码" placement="top" :show-after="400">
          <code class="code-text code-text--copy" @click="copyCode(row)">{{ row.code }}</code>
        </el-tooltip>
      </template>

      <template #name="{ row }">
        <span class="cell-text ellipsis">{{ row.name }}</span>
      </template>

      <template #scope="{ row }">
        <el-tag v-if="row.scope" size="small" effect="plain" class="scope-tag">{{ row.scope }}</el-tag>
        <span v-else class="cell-muted">—</span>
      </template>

      <template #description="{ row }">
        <el-tooltip v-if="row.description" :content="row.description" placement="top" :show-after="400">
          <span class="cell-text ellipsis">{{ row.description }}</span>
        </el-tooltip>
        <span v-else class="cell-muted">未填写</span>
      </template>

      <template #bind="{ row }">
        <el-tooltip v-if="bindTitle(row)" :content="`已绑定菜单「${bindTitle(row)}」`" placement="top" :show-after="400">
          <el-tag size="small" type="warning" effect="plain" class="bind-tag">{{ bindTitle(row) }}</el-tag>
        </el-tooltip>
        <span v-else class="cell-muted">未绑定</span>
      </template>

      <template #status="{ row }">
        <span class="status-cell">
          <el-switch
            :model-value="!row.is_disabled"
            size="small"
            :loading="statusBusy.has(row.code)"
            :disabled="statusBusy.has(row.code)"
            @change="(value) => toggleStatus(row, Boolean(value))"
          />
          <span class="status-text" :class="{ 'is-off': row.is_disabled }">{{ row.is_disabled ? "已禁用" : "启用中" }}</span>
        </span>
      </template>

      <template #updated="{ row }">
        <span class="time-text">{{ formatTime(row.updated_at) }}</span>
      </template>

      <template #action="{ row }">
        <el-button link type="primary" size="small" @click="openRemark(row)">修改备注</el-button>
      </template>

      <template #empty>
        <el-empty :description="codes.length > 0 ? '没有匹配的权限码，试试换个关键词或清空筛选' : '暂无权限码，请先执行 pnpm db:seed:permissions'" :image-size="80">
          <el-button v-if="hasFilter" size="small" @click="resetFilters">清空筛选</el-button>
        </el-empty>
      </template>
    </my-table>

    <footer class="code-foot">
      <span>共 {{ stats.total }} 个权限码</span>
      <span class="foot-dot" />
      <span>当前筛选 {{ rows.length }} 个</span>
      <span class="foot-dot" />
      <span>已绑定菜单 {{ stats.bound }} 个</span>
      <span class="foot-tip">备注与启停保存后立即生效</span>
    </footer>

    <el-dialog v-model="remarkVisible" title="修改备注" width="520px" top="12vh" draggable :close-on-click-modal="false" append-to-body @closed="handleRemarkClosed">
      <div v-if="remarkRow" class="remark-head">
        <code class="code-text">{{ remarkRow.code }}</code>
        <span class="remark-name">{{ remarkRow.name }}</span>
        <el-tag size="small" effect="plain">{{ remarkRow.scope }}</el-tag>
      </div>

      <el-input v-model="remarkText" type="textarea" :rows="4" maxlength="255" show-word-limit resize="none" placeholder="这条权限码的用途、影响范围、注意事项…" />

      <p class="remark-tip">备注只做说明，不参与权限校验；是否放行取决于列表里的启用开关。</p>

      <template #footer>
        <el-button @click="remarkVisible = false">取消</el-button>
        <el-button type="primary" :loading="remarkSaving" @click="saveRemark">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
  .code-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .code-head {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
    justify-content: space-between;
  }

  .code-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-text);
  }

  .code-desc {
    max-width: 680px;
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--app-text-3);
  }

  .code-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .toolbar-search {
    width: 214px;
  }

  .toolbar-select {
    width: 128px;
  }

  .btn-icon {
    margin-right: 4px;
    vertical-align: -2px;
  }

  .code-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 14px;
    border: 1px solid var(--app-glass-border);
    border-radius: var(--app-radius);
    background: var(--app-glass);
    box-shadow: var(--app-shadow-inset);
  }

  .stat-head {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .stat-icon {
    color: var(--app-text-3);
  }

  .stat-label {
    font-size: 12px;
    color: var(--app-text-3);
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--app-text);
  }

  .stat--success .stat-icon,
  .stat--success .stat-value {
    color: var(--app-success);
  }

  .stat--danger .stat-icon,
  .stat--danger .stat-value {
    color: var(--app-danger);
  }

  .stat--primary .stat-icon,
  .stat--primary .stat-value {
    color: var(--app-primary);
  }

  @media (max-width: 1100px) {
    .code-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .code-text {
    display: inline-block;
    max-width: 100%;
    padding: 1px 6px;
    overflow: hidden;
    font-family: ui-monospace, sfmono-regular, menlo, monospace;
    font-size: 12px;
    color: var(--app-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: color-mix(in srgb, var(--app-primary) 10%, transparent);
    border-radius: 5px;
  }

  .code-text--copy {
    cursor: copy;
    transition:
      background-color var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease);

    &:hover {
      background-color: color-mix(in srgb, var(--app-primary) 18%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-primary) 32%, transparent);
    }
  }

  .cell-text {
    display: block;
    overflow: hidden;
    font-size: 12.5px;
    color: var(--app-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-muted {
    font-size: 12px;
    color: var(--app-text-3);
  }

  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scope-tag {
    font-family: ui-monospace, sfmono-regular, menlo, monospace;
    font-size: 11.5px;
  }

  .bind-tag {
    max-width: 100%;
    font-weight: 400;

    :deep(.el-tag__content) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .status-cell {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }

  .status-text {
    font-size: 12px;
    color: var(--app-success);

    &.is-off {
      color: var(--app-danger);
    }
  }

  .time-text {
    font-size: 12px;
    color: var(--app-text-3);
    font-variant-numeric: tabular-nums;
  }

  .code-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--app-text-3);
  }

  .foot-dot {
    width: 3px;
    height: 3px;
    background-color: var(--app-text-3);
    border-radius: var(--app-radius-pill);
    opacity: 0.6;
  }

  .foot-tip {
    margin-left: auto;
  }

  .remark-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .remark-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--app-text);
  }

  .remark-tip {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--app-text-3);
  }

  @media (max-width: 720px) {
    .foot-tip {
      margin-left: 0;
    }
  }
</style>
