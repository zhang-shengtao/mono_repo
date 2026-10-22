<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Refresh, Search } from "@element-plus/icons-vue";
import { userApi } from "@/api/user";
import PageHeader from "@/components/PageHeader.vue";
import type { UserItem } from "@/types/user";
import { USER_STATUS_LABEL, USER_STATUS_TAG } from "@/utils/dict";
import { formatDateTime, orDash } from "@/utils/format";
import PermissionDrawer from "./PermissionDrawer.vue";
import UserFormDialog from "./UserFormDialog.vue";

const loading = ref(false);
const rows = ref<UserItem[]>([]);
const total = ref(0);

const query = reactive({
  page: 1,
  limit: 10,
  search: "",
  status: "all" as "all" | "normal" | "disabled",
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await userApi.list({ ...query });
    rows.value = result.list;
    total.value = result.total;
  } catch {
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function search(): void {
  query.page = 1;
  void load();
}

function resetQuery(): void {
  query.search = "";
  query.status = "all";
  query.page = 1;
  void load();
}

function handleSizeChange(size: number): void {
  query.limit = size;
  query.page = 1;
  void load();
}

const formVisible = ref(false);
const formMode = ref<"add" | "edit">("add");
const activeUser = ref<UserItem | null>(null);

function openAdd(): void {
  formMode.value = "add";
  activeUser.value = null;
  formVisible.value = true;
}

function openEdit(row: UserItem): void {
  formMode.value = "edit";
  activeUser.value = row;
  formVisible.value = true;
}

const permissionVisible = ref(false);
const permissionUser = ref<UserItem | null>(null);

function openPermission(row: UserItem): void {
  permissionUser.value = row;
  permissionVisible.value = true;
}

async function removeUser(row: UserItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.account}」吗？删除后该账号无法登录，且不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      confirmButtonClass: "el-button--danger",
    });
  } catch {
    return;
  }

  try {
    await userApi.remove(row.user_id);
    ElMessage.success("已删除");
    if (rows.value.length === 1 && query.page > 1) query.page -= 1;
    await load();
  } catch {
    // 拦截器已提示
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page">
    <PageHeader
      title="用户管理"
      description="管理当前账号的直属子账号。子账号只能被分配「你已拥有且允许转授」的菜单，删除账号前需先清理它的下级。"
    >
      <el-button v-perm="'system:user:add'" type="primary" :icon="Plus" @click="openAdd">新增账号</el-button>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </PageHeader>

    <section class="card">
      <div class="toolbar">
        <el-input
          v-model="query.search"
          :prefix-icon="Search"
          placeholder="按账号 / 昵称 / 备注搜索"
          clearable
          style="width: 240px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select v-model="query.status" style="width: 140px" @change="search">
          <el-option label="全部状态" value="all" />
          <el-option label="正常" value="normal" />
          <el-option label="已禁用" value="disabled" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
        <div class="toolbar__spacer" />
        <span class="muted">共 {{ total }} 个直属子账号</span>
      </div>

      <div class="table-wrap">
        <el-table v-loading="loading" :data="rows" row-key="user_id" empty-text="暂无直属子账号">
          <el-table-column label="账号" min-width="150">
            <template #default="{ row }">
              <span class="mono">{{ row.account }}</span>
            </template>
          </el-table-column>
          <el-table-column label="昵称" min-width="130" prop="nickname" show-overflow-tooltip />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="USER_STATUS_TAG[row.status as keyof typeof USER_STATUS_TAG]" size="small" effect="plain">
                {{ USER_STATUS_LABEL[row.status as keyof typeof USER_STATUS_LABEL] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ orDash(row.remark) }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button v-perm="'system:user:put'" link type="primary" @click="openEdit(row as UserItem)">
                编辑
              </el-button>
              <el-button
                v-perm="'system:user:permission:get'"
                link
                type="primary"
                @click="openPermission(row as UserItem)"
              >
                权限
              </el-button>
              <el-button v-perm="'system:user:delete'" link type="danger" @click="removeUser(row as UserItem)">
                删除
              </el-button>
            </template>
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
          @current-change="load"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

    <UserFormDialog v-model="formVisible" :mode="formMode" :record="activeUser" @success="load" />
    <PermissionDrawer v-model="permissionVisible" :user="permissionUser" @success="load" />
  </div>
</template>
