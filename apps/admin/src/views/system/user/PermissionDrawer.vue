<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ElMessage, ElTree } from "element-plus";
import { userApi } from "@/api/user";
import type { MenuType } from "@/types/menu";
import type { UserItem, UserPermissionItem } from "@/types/user";
import { MENU_TYPE_LABEL, MENU_TYPE_TAG, type TagType } from "@/utils/dict";
import { buildTree, menuTitle, type WithChildren } from "@/utils/menu";

interface PermissionNode extends UserPermissionItem {
  label: string;
  children: PermissionNode[];
}

const props = defineProps<{ user: UserItem | null }>();
const emit = defineEmits<{ success: [] }>();
const visible = defineModel<boolean>({ required: true });

const treeRef = ref<InstanceType<typeof ElTree>>();
const loading = ref(false);
const saving = ref(false);
const treeData = ref<PermissionNode[]>([]);
/** admin_menus_id → 是否允许继续转授 */
const transmit = ref<Record<number, boolean>>({});
const grantedCount = ref(0);

function toNode(node: WithChildren<UserPermissionItem>): PermissionNode {
  return {
    ...node,
    label: menuTitle({ admin_menus_id: node.admin_menus_id, meta: node.meta }),
    children: node.children.map(toNode),
  };
}

function typeLabel(type: string): string {
  return MENU_TYPE_LABEL[type as MenuType] ?? type;
}

function typeTag(type: string): TagType {
  return MENU_TYPE_TAG[type as MenuType] ?? "info";
}

async function load(): Promise<void> {
  const user = props.user;
  if (!user) return;

  loading.value = true;
  try {
    const { list } = await userApi.permissions(user.user_id);
    treeData.value = buildTree(list).map(toNode);

    const granted: Record<number, boolean> = {};
    for (const item of list) {
      if (item.granted) granted[item.admin_menus_id] = item.is_transmit;
    }
    transmit.value = granted;
    grantedCount.value = Object.keys(granted).length;

    // 等 el-tree 渲染完再回填勾选，否则 ref 还是空的
    await nextTick();
    treeRef.value?.setCheckedKeys(Object.keys(granted).map(Number));
    grantedCount.value = countChecked();
  } catch {
    treeData.value = [];
  } finally {
    loading.value = false;
  }
}

function countChecked(): number {
  const checked = (treeRef.value?.getCheckedKeys() ?? []) as number[];
  const halfChecked = (treeRef.value?.getHalfCheckedKeys() ?? []) as number[];
  return checked.length + halfChecked.length;
}

function onCheck(): void {
  grantedCount.value = countChecked();
}

watch(visible, (open) => {
  if (open) void load();
});

function setTransmit(menuId: number, value: string | number | boolean): void {
  transmit.value = { ...transmit.value, [menuId]: value === true };
}

async function save(): Promise<void> {
  const user = props.user;
  if (!user) return;

  const checked = (treeRef.value?.getCheckedKeys() ?? []) as number[];
  const halfChecked = (treeRef.value?.getHalfCheckedKeys() ?? []) as number[];
  const menuIds = [...new Set([...checked, ...halfChecked])];

  saving.value = true;
  try {
    await userApi.savePermissions({
      user_id: user.user_id,
      permissions: menuIds.map((menuId) => ({
        admin_menus_id: menuId,
        is_transmit: Boolean(transmit.value[menuId]),
      })),
    });
    ElMessage.success("权限已保存");
    visible.value = false;
    emit("success");
  } catch {
    // 拦截器已提示
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-drawer v-model="visible" :title="`分配权限 · ${props.user?.nickname ?? ''}`" size="520px" destroy-on-close>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px">
      <template #title>勾选要分配给该账号的菜单</template>
      <div style="font-size: 12px; line-height: 1.7">
        目录决定侧边栏结构，页面决定能进哪些路由，按钮决定页面里能点哪些操作。打开「转授」后，该账号可以把这条菜单继续分给它自己的下级。保存后该账号的登录会话会失效，需要重新登录。
      </div>
    </el-alert>

    <div v-loading="loading">
      <el-tree
        v-if="treeData.length > 0"
        ref="treeRef"
        class="permission-tree"
        :data="treeData"
        node-key="admin_menus_id"
        :props="{ label: 'label', children: 'children' }"
        show-checkbox
        default-expand-all
        :expand-on-click-node="false"
        @check="onCheck"
      >
        <template #default="{ data }">
          <div class="tree-node">
            <span class="tree-node__label">{{ data.label }}</span>
            <el-tag :type="typeTag(data.type)" size="small" effect="plain">{{ typeLabel(data.type) }}</el-tag>
            <span v-if="data.permission" class="tree-node__code">{{ data.permission }}</span>
            <span class="tree-node__transmit" @click.stop>
              <span>转授</span>
              <el-switch
                size="small"
                :model-value="Boolean(transmit[data.admin_menus_id])"
                @change="setTransmit(data.admin_menus_id, $event)"
              />
            </span>
          </div>
        </template>
      </el-tree>

      <el-empty v-else-if="!loading" description="没有可分配的菜单">
        <div class="muted" style="font-size: 12px; line-height: 1.7">
          可能的原因：当前账号没有可转授的菜单，或系统还没有配置任何菜单。
        </div>
      </el-empty>
    </div>

    <template #footer>
      <div style="display: flex; align-items: center; justify-content: space-between">
        <span class="muted" style="font-size: 12px">已选 {{ grantedCount }} 项（含自动补齐的父级目录）</span>
        <span>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存权限</el-button>
        </span>
      </div>
    </template>
  </el-drawer>
</template>
