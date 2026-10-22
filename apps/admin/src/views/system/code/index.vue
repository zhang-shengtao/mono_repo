<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import { codeApi } from "@/api/code";
import PageHeader from "@/components/PageHeader.vue";
import type { CodeBoundMenu, PermissionCodeItem } from "@/types/code";
import type { MenuType } from "@/types/menu";
import { MENU_TYPE_LABEL, MENU_TYPE_TAG } from "@/utils/dict";
import { formatDateTime, orDash } from "@/utils/format";

const loading = ref(false);
const rows = ref<PermissionCodeItem[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  limit: 10,
  search: "",
  is_disabled: "all" as "all" | "true" | "false",
});

async function load(resetPage = false): Promise<void> {
  if (resetPage) query.page = 1;
  loading.value = true;
  try {
    const result = await codeApi.list({ ...query });
    rows.value = result.list;
    total.value = result.total;
  } catch {
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function resetQuery(): void {
  query.search = "";
  query.is_disabled = "all";
  void load(true);
}

function handleSizeChange(size: number): void {
  query.limit = size;
  void load(true);
}

function menuTitleOf(menu: CodeBoundMenu | null | undefined): string {
  const title = menu?.meta?.title;
  return typeof title === "string" && title ? title : menu ? `菜单 #${menu.admin_menus_id}` : "";
}

function menuTypeLabel(menu: CodeBoundMenu | null | undefined): string {
  return menu ? (MENU_TYPE_LABEL[menu.type as MenuType] ?? menu.type) : "";
}

function menuTypeTag(menu: CodeBoundMenu | null | undefined) {
  return menu ? (MENU_TYPE_TAG[menu.type as MenuType] ?? "info") : "info";
}

async function toggleDisabled(row: PermissionCodeItem, enabled: string | number | boolean): Promise<void> {
  const nextDisabled = enabled !== true;
  try {
    await codeApi.setDisabled(row.code, nextDisabled);
    row.is_disabled = nextDisabled;
    ElMessage.success(nextDisabled ? "已禁用" : "已启用");
  } catch {
    // 失败保持原状态
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <PageHeader
      title="权限码"
      description="权限码的唯一事实源是 code 表：由后端的权限种子脚本同步（新增 / 改名），前端只负责查看与启停。禁用后所有账号立即失去该权限。"
    >
      <el-button :icon="Refresh" @click="load()">刷新</el-button>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon>
      <template #title>新增权限码不在这个页面做</template>
      <div style="font-size: 12px; line-height: 1.7">
        权限码要在 apps/services/src/permissions 里声明，再跑
        <span class="mono">pnpm db:seed:permissions:dev</span>
        同步进库。控制台只做启停，避免前后端权限码各写一份、对不上。
      </div>
    </el-alert>

    <section class="card">
      <div class="toolbar">
        <el-input
          v-model="query.search"
          :prefix-icon="Search"
          placeholder="按编码 / 分组 / 名称 / 描述搜索"
          clearable
          style="width: 280px"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <el-select v-model="query.is_disabled" style="width: 140px" @change="load(true)">
          <el-option label="全部状态" value="all" />
          <el-option label="已启用" value="false" />
          <el-option label="已禁用" value="true" />
        </el-select>
        <el-button type="primary" @click="load(true)">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
        <div class="toolbar__spacer" />
        <span class="muted">共 {{ total }} 条</span>
      </div>

      <div class="table-wrap">
        <el-table v-loading="loading" :data="rows" row-key="code" empty-text="暂无权限码，先跑权限种子脚本">
          <el-table-column label="权限码" min-width="200">
            <template #default="{ row }">
              <span class="mono">{{ row.code }}</span>
            </template>
          </el-table-column>

          <el-table-column label="名称" min-width="130" prop="name" show-overflow-tooltip />

          <el-table-column label="分组" width="110" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ row.scope }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="描述" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ orDash(row.description) }}</template>
          </el-table-column>

          <el-table-column label="绑定菜单" min-width="190">
            <template #default="{ row }">
              <span v-if="row.menu" class="menu-name">
                <span>{{ menuTitleOf(row.menu as CodeBoundMenu) }}</span>
                <el-tag :type="menuTypeTag(row.menu as CodeBoundMenu)" size="small" effect="plain">
                  {{ menuTypeLabel(row.menu as CodeBoundMenu) }}
                </el-tag>
              </span>
              <span v-else class="muted">未绑定</span>
            </template>
          </el-table-column>

          <el-table-column label="启用" width="82" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="!row.is_disabled"
                v-perm="'system:code:put'"
                @change="toggleDisabled(row as PermissionCodeItem, $event)"
              />
            </template>
          </el-table-column>

          <el-table-column label="更新时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.limit"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="load()"
          @size-change="handleSizeChange"
        />
      </div>
    </section>
  </div>
</template>
