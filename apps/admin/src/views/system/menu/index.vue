<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowDown, ArrowUp, Plus, Refresh, Search } from "@element-plus/icons-vue";
import { codeApi } from "@/api/code";
import { menuApi } from "@/api/menu";
import PageHeader from "@/components/PageHeader.vue";
import type { PermissionCodeItem } from "@/types/code";
import type { MenuNode, MenuUpdatePayload } from "@/types/menu";
import { MENU_TYPE_LABEL, MENU_TYPE_TAG } from "@/utils/dict";
import { menuTitle } from "@/utils/menu";
import MenuFormDialog from "./MenuFormDialog.vue";

const loading = ref(false);
const tree = ref<MenuNode[]>([]);
const search = ref("");
const expandAll = ref(true);
/** el-table 的 default-expand-all 只在挂载时生效，改它需要重建表格 */
const tableKey = ref(0);
const codes = ref<PermissionCodeItem[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await menuApi.list(search.value.trim());
    tree.value = result.list;
  } catch {
    tree.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadCodes(): Promise<void> {
  try {
    const result = await codeApi.filter({ is_disabled: false });
    codes.value = result.list;
  } catch {
    codes.value = [];
  }
}

function toggleExpand(): void {
  expandAll.value = !expandAll.value;
  tableKey.value += 1;
}

const formVisible = ref(false);
const formMode = ref<"add" | "edit">("add");
const activeMenu = ref<MenuNode | null>(null);
const presetParentId = ref(0);

function openAdd(parentId = 0): void {
  formMode.value = "add";
  activeMenu.value = null;
  presetParentId.value = parentId;
  formVisible.value = true;
}

function openEdit(row: MenuNode): void {
  formMode.value = "edit";
  activeMenu.value = row;
  presetParentId.value = row.parent_id;
  formVisible.value = true;
}

async function onStatusChange(row: MenuNode, value: string | number | boolean): Promise<void> {
  const nextDisabled = value !== true;
  const payload: MenuUpdatePayload = {
    admin_menus_id: row.admin_menus_id,
    type: row.type,
    parent_id: row.parent_id,
    meta: row.meta,
    permission: row.permission,
    sort: row.sort,
    is_disabled: nextDisabled,
  };

  try {
    await menuApi.update(payload);
    row.is_disabled = nextDisabled;
    ElMessage.success(nextDisabled ? "已禁用" : "已启用");
  } catch {
    // 失败时保持原状态：行数据没动，switch 的 model-value 会还原
  }
}

async function removeMenu(row: MenuNode): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${menuTitle(row)}」吗？它下面的所有子菜单、按钮会一并删除，且不可恢复。`,
      "删除菜单",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
        confirmButtonClass: "el-button--danger",
      },
    );
  } catch {
    return;
  }

  try {
    await menuApi.remove(row.admin_menus_id);
    ElMessage.success("已删除");
    await Promise.all([load(), loadCodes()]);
  } catch {
    // 拦截器已提示
  }
}

async function refresh(): Promise<void> {
  await Promise.all([load(), loadCodes()]);
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="page">
    <PageHeader
      title="菜单管理"
      description="菜单即路由：目录做分组、页面生成路由、按钮挂权限码。页面的路由路径要和前端组件对应，匹配不到时会渲染「组件未实现」提示页。"
    >
      <el-button v-perm="'system:menu:add'" type="primary" :icon="Plus" @click="openAdd(0)">新增根菜单</el-button>
      <el-button :icon="Refresh" @click="refresh">刷新</el-button>
    </PageHeader>

    <section class="card">
      <div class="toolbar">
        <el-input
          v-model="search"
          :prefix-icon="Search"
          placeholder="按名称 / 路径 / 路由名 / 权限码搜索"
          clearable
          style="width: 280px"
          @keyup.enter="load"
          @clear="load"
        />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button
          @click="
            search = '';
            load();
          "
          >重置</el-button
        >
        <div class="toolbar__spacer" />
        <el-button :icon="expandAll ? ArrowUp : ArrowDown" @click="toggleExpand">
          {{ expandAll ? "收起全部" : "展开全部" }}
        </el-button>
      </div>

      <div class="table-wrap">
        <el-table
          :key="tableKey"
          v-loading="loading"
          :data="tree"
          row-key="admin_menus_id"
          :tree-props="{ children: 'children' }"
          :default-expand-all="expandAll"
          empty-text="还没有任何菜单，先新增一个目录"
        >
          <el-table-column label="名称" min-width="220">
            <template #default="{ row }">
              <div class="menu-name">
                <el-icon v-if="row.meta?.icon" class="menu-name__icon"><component :is="row.meta.icon" /></el-icon>
                <span>{{ menuTitle(row) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="类型" width="86" align="center">
            <template #default="{ row }">
              <el-tag :type="MENU_TYPE_TAG[row.type as keyof typeof MENU_TYPE_TAG]" size="small" effect="plain">
                {{ MENU_TYPE_LABEL[row.type as keyof typeof MENU_TYPE_LABEL] }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="路由路径" min-width="150">
            <template #default="{ row }">
              <span class="mono">{{ row.meta?.path || "-" }}</span>
            </template>
          </el-table-column>

          <el-table-column label="路由名" min-width="140">
            <template #default="{ row }">
              <span class="mono">{{ row.meta?.name || "-" }}</span>
            </template>
          </el-table-column>

          <el-table-column label="权限码" min-width="180">
            <template #default="{ row }">
              <span class="mono">{{ row.permission || "-" }}</span>
            </template>
          </el-table-column>

          <el-table-column label="排序" width="72" align="center" prop="sort" />

          <el-table-column label="启用" width="82" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="!row.is_disabled"
                v-perm="'system:menu:put'"
                @change="onStatusChange(row as MenuNode, $event)"
              />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.type !== 'button'"
                v-perm="'system:menu:add'"
                link
                type="primary"
                @click="openAdd(row.admin_menus_id)"
              >
                新增子级
              </el-button>
              <el-button v-perm="'system:menu:put'" link type="primary" @click="openEdit(row as MenuNode)">
                编辑
              </el-button>
              <el-button v-perm="'system:menu:delete'" link type="danger" @click="removeMenu(row as MenuNode)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <MenuFormDialog
      v-model="formVisible"
      :mode="formMode"
      :record="activeMenu"
      :preset-parent-id="presetParentId"
      :tree="tree"
      :codes="codes"
      @success="refresh"
    />
  </div>
</template>
