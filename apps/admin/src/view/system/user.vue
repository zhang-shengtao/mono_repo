<script setup lang="ts">
  import type { MenuNode, RoleMenuScope, RoleOption, UserItem } from "@repo/shared";
  import type { FormInstance, FormRules } from "element-plus";
  import { createUser, deleteUser, fetchUserList, fetchUserPermission, saveUserPermission, updateUser } from "@/api/user";
  import useUserStore from "@/pinia/user";
  import type { RouteMenuProps } from "@/utils/perms";
  import { usePerms } from "@/utils/perms";

  defineOptions({ name: "systemUser" });

  defineProps<RouteMenuProps>();

  const { has } = usePerms();

  const userStore = useUserStore();

  const isSuperAdmin = computed(() => userStore.profile?.parent_id === 0);

  type BaseColumn = InstanceType<GlobalComponents["MyTable"]>["$props"]["columns"][number];
  type TableColumn<Row> = Omit<BaseColumn, "children" | "prop" | "formatter"> & {
    children?: TableColumn<Row>[];
    prop?: string | ((scope: { row: Row; column: any; $index: number }) => unknown);
    formatter?: (scope: { row: Row; column: any; $index: number }) => unknown;
  };

  type StatusFilter = "" | "normal" | "disabled";

  const STATUS_OPTIONS: { value: Exclude<StatusFilter, "">; label: string }[] = [
    { value: "normal", label: "正常" },
    { value: "disabled", label: "已禁用" },
  ];

  const columns = computed<TableColumn<UserItem>[]>(() => [
    { label: "账号", slot: "account", minWidth: 150 },
    { label: "昵称", slot: "nickname", minWidth: 130 },
    ...(isSuperAdmin.value ? [{ label: "上级", slot: "parent", minWidth: 120 } as TableColumn<UserItem>] : []),
    { label: "状态", slot: "status", width: 118 },
    { label: "角色", slot: "roles", minWidth: 190 },
    { label: "权限", slot: "menus", width: 90, align: "center" },
    { label: "备注", slot: "remark", minWidth: 160 },
    { label: "更新时间", slot: "updated", width: 140 },
    { label: "操作", slot: "action", width: 178, fixed: "right" },
  ]);

  const loading = ref(false);
  const users = ref<UserItem[]>([]);
  const keyword = ref("");
  const statusFilter = ref<StatusFilter>("");
  const statusBusy = reactive(new Set<number>());

  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    return users.value.filter((item) => {
      if (statusFilter.value && item.status !== statusFilter.value) return false;
      if (!kw) return true;
      return [item.account, item.nickname, item.remark ?? ""].some((value) => value.toLowerCase().includes(kw));
    });
  });

  const hasFilter = computed(() => Boolean(keyword.value.trim() || statusFilter.value));

  const userNameById = computed(() => {
    const map = new Map<number, string>();
    for (const item of users.value) map.set(item.user_id, item.nickname || item.account);
    const me = userStore.profile;
    if (me) map.set(me.user_id, me.nickname || me.account);
    return map;
  });

  function parentLabel(parent_id?: number | null) {
    if (!parent_id) return "—";
    return userNameById.value.get(parent_id) ?? `用户 ${parent_id}`;
  }

  function resetFilters() {
    keyword.value = "";
    statusFilter.value = "";
  }

  async function loadList() {
    loading.value = true;
    try {
      users.value = (await fetchUserList()).list;
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false;
    }
  }

  async function toggleStatus(row: UserItem, enabled: boolean) {
    if (statusBusy.has(row.user_id)) return;

    if (!enabled) {
      try {
        await ElMessageBox.confirm(`禁用后「${row.nickname}」会立刻退出登录并无法再访问后台。确定禁用吗？`, "禁用确认", {
          type: "warning",
          confirmButtonText: "禁用",
          cancelButtonText: "取消",
        });
      } catch {
        return;
      }
    }

    statusBusy.add(row.user_id);
    try {
      const updated = await updateUser({
        user_id: row.user_id,
        nickname: row.nickname,
        password: null,
        status: enabled ? "normal" : "disabled",
        remark: row.remark,
      });
      Object.assign(row, updated);
      ElMessage.success(enabled ? "已启用" : "已禁用");
    } catch {
      // 请求层已统一提示，开关保持原状态
    } finally {
      statusBusy.delete(row.user_id);
    }
  }

  async function removeUser(row: UserItem) {
    try {
      await ElMessageBox.confirm(`确定删除「${row.nickname}」吗？该账号会被软删除，已分配的权限一并收回。`, "删除确认", {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      });
    } catch {
      return;
    }

    try {
      await deleteUser(row.user_id);
      ElMessage.success("已删除");
      await loadList();
    } catch {
      // 请求层已统一提示
    }
  }

  function emptyForm() {
    return {
      user_id: null as number | null,
      account: "",
      nickname: "",
      password: "",
      status: "normal" as "normal" | "disabled",
      remark: "",
    };
  }

  type UserForm = ReturnType<typeof emptyForm>;

  const form = reactive<UserForm>(emptyForm());
  const formRef = useTemplateRef<FormInstance>("formRef");
  const dialogVisible = ref(false);
  const dialogTitle = ref("");
  const submitting = ref(false);

  const isEdit = computed(() => Boolean(form.user_id));

  const rules = computed<FormRules>(() => {
    const result: FormRules = {
      nickname: [
        { required: true, message: "请输入昵称", trigger: "blur" },
        { max: 50, message: "昵称最多 50 个字符", trigger: "blur" },
      ],
    };

    if (isEdit.value) {
      result.password = [{ min: 6, max: 128, message: "密码 6 至 128 个字符", trigger: "blur" }];
      return result;
    }

    result.account = [
      { required: true, message: "请输入登录账号", trigger: "blur" },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: "以字母开头，只能包含字母、数字、下划线和中划线", trigger: "blur" },
      { min: 3, max: 50, message: "账号 3 至 50 个字符", trigger: "blur" },
    ];
    result.password = [
      { required: true, message: "请输入初始密码", trigger: "blur" },
      { min: 6, max: 128, message: "密码 6 至 128 个字符", trigger: "blur" },
    ];
    return result;
  });

  function resetForm() {
    formRef.value?.clearValidate();
    Object.assign(form, emptyForm());
  }

  function openCreate() {
    resetForm();
    dialogTitle.value = "新增用户";
    dialogVisible.value = true;
  }

  function openEdit(row: UserItem) {
    resetForm();
    Object.assign(form, {
      user_id: row.user_id,
      account: row.account,
      nickname: row.nickname,
      password: "",
      status: row.status === "disabled" ? "disabled" : "normal",
      remark: row.remark ?? "",
    });
    dialogTitle.value = `编辑用户 · ${row.account}`;
    dialogVisible.value = true;
  }

  async function submit() {
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;

    submitting.value = true;
    try {
      if (form.user_id) {
        await updateUser({
          user_id: form.user_id,
          nickname: form.nickname.trim(),
          password: form.password || null,
          status: form.status,
          remark: form.remark.trim() || null,
        });
        ElMessage.success("已保存");
      } else {
        await createUser({
          account: form.account.trim(),
          nickname: form.nickname.trim(),
          password: form.password,
          remark: form.remark.trim() || null,
        });
        ElMessage.success("已创建");
      }
      dialogVisible.value = false;
      await loadList();
    } catch {
      // 请求层已统一提示，弹窗保持打开方便修改
    } finally {
      submitting.value = false;
    }
  }

  const permVisible = ref(false);
  const permLoading = ref(false);
  const permSaving = ref(false);
  const permUser = ref<UserItem | null>(null);

  const permissionRoles = ref<number[]>([]);
  const roleOptions = ref<RoleOption[]>([]);
  const scope = ref<RoleMenuScope | null>(null);
  const checkedMenus = ref<number[]>([]);
  const transmitMenus = ref<number[]>([]);

  let prevRoles: number[] = [];

  const roleOptionMap = computed(() => new Map(roleOptions.value.map((role) => [role.roles_id, role])));
  const assignableSet = computed(() => new Set(scope.value?.assignable ?? []));
  const canTransmit = computed(() => scope.value?.can_transmit ?? false);
  const checkedCount = computed(() => checkedMenus.value.length);

  const allowedMenuIds = computed(() => {
    const set = new Set<number>();
    for (const roles_id of permissionRoles.value) {
      for (const menus_id of roleOptionMap.value.get(roles_id)?.menus_id ?? []) set.add(menus_id);
    }
    return set;
  });

  const candidateTree = computed(() => filterTree(scope.value?.list ?? [], allowedMenuIds.value));

  function filterTree(nodes: MenuNode[], allowed: Set<number>): MenuNode[] {
    const result: MenuNode[] = [];
    for (const node of nodes) {
      const children = filterTree(node.children ?? [], allowed);
      if (!allowed.has(node.menus_id) && children.length === 0) continue;

      const copy: MenuNode = { ...node };
      if (children.length > 0) copy.children = children;
      else delete copy.children;
      result.push(copy);
    }
    return result;
  }

  const candidateIndex = computed(() => {
    const parent = new Map<number, number>();
    const children = new Map<number, number[]>();

    const walk = (nodes: MenuNode[], parentId: number) => {
      for (const node of nodes) {
        parent.set(node.menus_id, parentId);
        children.set(
          node.menus_id,
          (node.children ?? []).map((child) => child.menus_id),
        );
        if (node.children?.length) walk(node.children, node.menus_id);
      }
    };
    walk(candidateTree.value, 0);

    return { parent, children };
  });

  function descendantIds(menus_id: number) {
    const result: number[] = [];
    const walk = (id: number) => {
      for (const child of candidateIndex.value.children.get(id) ?? []) {
        result.push(child);
        walk(child);
      }
    };
    walk(menus_id);
    return result;
  }

  function ancestorIds(menus_id: number) {
    const result: number[] = [];
    let cursor = candidateIndex.value.parent.get(menus_id) ?? 0;
    while (cursor) {
      result.push(cursor);
      cursor = candidateIndex.value.parent.get(cursor) ?? 0;
    }
    return result;
  }

  async function openPermission(row: UserItem) {
    permUser.value = row;
    permissionRoles.value = [];
    roleOptions.value = [];
    scope.value = null;
    checkedMenus.value = [];
    transmitMenus.value = [];
    prevRoles = [];
    permVisible.value = true;

    permLoading.value = true;
    try {
      const detail = await fetchUserPermission(row.user_id);
      roleOptions.value = detail.roles;
      scope.value = detail.scope;
      permissionRoles.value = [...detail.roles_id];
      checkedMenus.value = detail.menus.map((item) => item.menus_id);
      transmitMenus.value = detail.menus.filter((item) => item.is_transmit).map((item) => item.menus_id);
      prevRoles = [...detail.roles_id];
    } catch {
      permVisible.value = false;
    } finally {
      permLoading.value = false;
    }
  }

  function handleRolesChange(next: number[]) {
    const added = next.filter((id) => !prevRoles.includes(id));
    const removed = prevRoles.filter((id) => !next.includes(id));
    const assignable = assignableSet.value;

    for (const roles_id of added) {
      for (const menus_id of roleOptionMap.value.get(roles_id)?.menus_id ?? []) {
        if (!assignable.has(menus_id)) continue;
        if (!checkedMenus.value.includes(menus_id)) checkedMenus.value = [...checkedMenus.value, menus_id];
      }
    }

    if (removed.length > 0) {
      const covered = new Set<number>();
      for (const roles_id of next) {
        for (const menus_id of roleOptionMap.value.get(roles_id)?.menus_id ?? []) covered.add(menus_id);
      }
      checkedMenus.value = checkedMenus.value.filter((id) => covered.has(id));
      transmitMenus.value = transmitMenus.value.filter((id) => checkedMenus.value.includes(id));
    }

    prevRoles = [...next];
  }

  function isAssignable(menus_id?: number) {
    return menus_id !== undefined && assignableSet.value.has(menus_id);
  }

  function isAllowed(menus_id?: number) {
    return menus_id !== undefined && allowedMenuIds.value.has(menus_id);
  }

  function isChecked(menus_id?: number) {
    return menus_id !== undefined && checkedMenus.value.includes(menus_id);
  }

  function isTransmit(menus_id?: number) {
    return menus_id !== undefined && transmitMenus.value.includes(menus_id);
  }

  function canToggle(menus_id?: number) {
    return isChecked(menus_id) || (isAllowed(menus_id) && isAssignable(menus_id));
  }

  function applyChecked(ids: number[]) {
    const next = new Set(checkedMenus.value);
    for (const id of ids) {
      if (next.has(id) || (allowedMenuIds.value.has(id) && assignableSet.value.has(id))) next.add(id);
    }
    checkedMenus.value = [...next].sort((a, b) => a - b);

    if (!canTransmit.value) return;
    const transmit = new Set(transmitMenus.value);
    for (const id of ids) {
      if (next.has(id)) transmit.add(id);
    }
    transmitMenus.value = [...transmit].sort((a, b) => a - b);
  }

  function toggleChecked(menus_id: number, value: boolean) {
    if (value) {
      applyChecked([menus_id, ...descendantIds(menus_id), ...ancestorIds(menus_id)]);
      return;
    }

    const removed = new Set([menus_id, ...descendantIds(menus_id)]);
    for (const ancestor of ancestorIds(menus_id)) {
      const rest = descendantIds(ancestor).some((id) => !removed.has(id) && checkedMenus.value.includes(id));
      if (rest) break;
      removed.add(ancestor);
    }

    checkedMenus.value = checkedMenus.value.filter((id) => !removed.has(id));
    transmitMenus.value = transmitMenus.value.filter((id) => !removed.has(id));
  }

  function toggleTransmit(menus_id: number, value: boolean) {
    if (!value) {
      transmitMenus.value = transmitMenus.value.filter((id) => id !== menus_id);
      return;
    }
    if (!checkedMenus.value.includes(menus_id)) return;
    if (!transmitMenus.value.includes(menus_id)) transmitMenus.value = [...transmitMenus.value, menus_id];
  }

  function checkAllMenus() {
    const ids = new Set(checkedMenus.value);
    for (const menus_id of allowedMenuIds.value) {
      if (assignableSet.value.has(menus_id)) ids.add(menus_id);
    }
    checkedMenus.value = [...ids].sort((a, b) => a - b);
    if (canTransmit.value) transmitMenus.value = [...allowedMenuIds.value].filter((id) => assignableSet.value.has(id));
  }

  function clearMenus() {
    checkedMenus.value = [];
    transmitMenus.value = [];
  }

  async function submitPermission() {
    if (!permUser.value) return;

    permSaving.value = true;
    try {
      const detail = await saveUserPermission({
        user_id: permUser.value.user_id,
        roles_id: permissionRoles.value,
        menus_id: checkedMenus.value,
        transmit_menus_id: transmitMenus.value.filter((id) => checkedMenus.value.includes(id)),
      });

      permissionRoles.value = [...detail.roles_id];
      checkedMenus.value = detail.menus.map((item) => item.menus_id);
      transmitMenus.value = detail.menus.filter((item) => item.is_transmit).map((item) => item.menus_id);
      prevRoles = [...detail.roles_id];

      ElMessage.success("权限已保存");
      permVisible.value = false;
      await loadList();
    } catch {
      // 请求层已统一提示，弹窗保持打开方便修改
    } finally {
      permSaving.value = false;
    }
  }

  function roleTags(row?: Partial<UserItem>) {
    return row?.roles ?? [];
  }

  function menuCount(row?: Partial<UserItem>) {
    return row?.menus_count ?? 0;
  }

  function statusText(status?: UserItem["status"]) {
    if (status === "disabled") return "已禁用";
    if (status === "deleted") return "已删除";
    return "正常";
  }

  function formatTime(value?: string | null) {
    if (!value) return "—";
    return String(value).replace("T", " ").slice(0, 16);
  }

  const MENU_TYPE_LABEL = { directory: "目录", page: "页面", button: "按钮" } as const;

  function menuTitle(row?: Partial<MenuNode>) {
    return row?.meta?.title || "未命名菜单";
  }

  function menuTypeLabel(type?: MenuNode["type"]) {
    return type ? MENU_TYPE_LABEL[type] : "—";
  }

  function menuTypeTag(type?: MenuNode["type"]) {
    return type === "page" ? "success" : type === "button" ? "warning" : "info";
  }

  onMounted(() => {
    void loadList();
  });
</script>

<template>
  <div class="user-page">
    <header class="user-head">
      <div>
        <h1 class="user-title">用户管理</h1>
        <p class="user-desc">{{ isSuperAdmin ? "这里是全部账号：账号、启停、角色与菜单权限都在这一页维护。" : "这里只有你的直属下级：账号、启停、角色与菜单权限都在这一页维护。" }}</p>
        <p class="user-desc">分配权限时先选角色，再从角色带的菜单里勾选；勾了「可下放」的菜单，该用户才能继续分配给他的下级。</p>
      </div>

      <div class="user-toolbar">
        <el-input v-model="keyword" class="toolbar-search" clearable placeholder="账号 / 昵称 / 备注">
          <template #prefix><my-icon name="Search" :size="14" /></template>
        </el-input>

        <el-select v-model="statusFilter" class="toolbar-select" clearable placeholder="全部状态">
          <el-option v-for="item in STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-button v-if="hasFilter" text @click="resetFilters">清空筛选</el-button>

        <el-button :loading="loading" @click="loadList">
          <my-icon name="Refresh" :size="14" class="btn-icon" />
          刷新
        </el-button>

        <el-button v-if="has('system:user:add')" type="primary" @click="openCreate">
          <my-icon name="Plus" :size="14" class="btn-icon" />
          新增用户
        </el-button>
      </div>
    </header>

    <my-table v-loading="loading" :data="rows" :columns="columns" row-key="user_id" size="small" border>
      <template #account="{ row }">
        <span class="cell-strong">{{ row.account }}</span>
      </template>

      <template #nickname="{ row }">
        <span class="cell-text ellipsis">{{ row.nickname }}</span>
      </template>

      <template #parent="{ row }">
        <span class="cell-muted ellipsis">{{ parentLabel(row?.parent_id) }}</span>
      </template>

      <template #status="{ row }">
        <span class="status-cell">
          <el-switch
            :model-value="row.status !== 'disabled'"
            size="small"
            :loading="statusBusy.has(row.user_id)"
            :disabled="statusBusy.has(row.user_id)"
            @change="(value) => toggleStatus(row, Boolean(value))"
          />
          <span class="status-text" :class="{ 'is-off': row.status === 'disabled' }">{{ statusText(row.status) }}</span>
        </span>
      </template>

      <template #roles="{ row }">
        <span v-if="roleTags(row).length > 0" class="role-tags">
          <el-tag v-for="role in roleTags(row)" :key="role.roles_id" size="small" effect="plain">{{ role.roles_name }}</el-tag>
        </span>
        <span v-else class="cell-muted">未分配</span>
      </template>

      <template #menus="{ row }">
        <el-tooltip :content="`已分配 ${menuCount(row)} 个菜单`" placement="top" :show-after="400">
          <span class="count-text" :class="{ 'is-zero': menuCount(row) === 0 }">{{ menuCount(row) }}</span>
        </el-tooltip>
      </template>

      <template #remark="{ row }">
        <el-tooltip v-if="row.remark" :content="row.remark" placement="top" :show-after="400">
          <span class="cell-text ellipsis">{{ row.remark }}</span>
        </el-tooltip>
        <span v-else class="cell-muted">未填写</span>
      </template>

      <template #updated="{ row }">
        <span class="time-text">{{ formatTime(row.updated_at) }}</span>
      </template>

      <template #action="{ row }">
        <span class="action-cell">
          <el-button v-if="has('system:user:put')" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="has('system:user:permission:put')" link type="primary" size="small" @click="openPermission(row)">分配权限</el-button>
          <el-button v-if="has('system:user:delete')" link type="danger" size="small" @click="removeUser(row)">删除</el-button>
        </span>
      </template>

      <template #empty>
        <el-empty :description="users.length > 0 ? '没有匹配的用户，试试换个关键词或清空筛选' : '还没有下级账号，先新增一个吧'" :image-size="80">
          <el-button v-if="hasFilter" size="small" @click="resetFilters">清空筛选</el-button>
        </el-empty>
      </template>
    </my-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" top="8vh" draggable :close-on-click-modal="false" append-to-body @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="82px" class="user-form">
        <el-form-item label="登录账号" prop="account">
          <el-input v-model="form.account" :disabled="isEdit" maxlength="50" placeholder="字母开头，如 zhangsan" />
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" maxlength="50" show-word-limit placeholder="显示在后台的名字" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password maxlength="128" :placeholder="isEdit ? '留空表示不修改' : '6 至 128 个字符'" />
        </el-form-item>

        <el-form-item v-if="isEdit" label="状态">
          <span class="inline-field">
            <el-switch :model-value="form.status === 'normal'" active-text="正常" inactive-text="禁用" inline-prompt @change="(value) => (form.status = value ? 'normal' : 'disabled')" />
            <span class="form-tip">禁用后该账号会立刻退出登录</span>
          </span>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="255" show-word-limit resize="none" placeholder="可选，方便以后认人" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permVisible" :title="`分配权限 · ${permUser?.nickname ?? ''}`" width="820px" top="8vh" draggable :close-on-click-modal="false" append-to-body>
      <div v-loading="permLoading" class="perm-body">
        <el-form label-width="72px" class="perm-form">
          <el-form-item label="角色">
            <el-select
              v-model="permissionRoles"
              class="field-full"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              filterable
              placeholder="先选角色，菜单会按角色自动带出来"
              @change="handleRolesChange"
            >
              <el-option v-for="role in roleOptions" :key="role.roles_id" :label="role.roles_name" :value="role.roles_id">
                <span class="role-option">
                  <span class="role-option-name">{{ role.roles_name }}</span>
                  <span class="role-option-count">{{ role.menus_id.length }} 个菜单</span>
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <div class="menu-panel">
          <div class="menu-tools">
            <span class="menu-count">
              已选
              <b>{{ checkedCount }}</b>
              项
              <template v-if="canTransmit && transmitMenus.length > 0">（{{ transmitMenus.length }} 项可下放）</template>
            </span>
            <span class="menu-actions">
              <el-button link type="primary" size="small" :disabled="permissionRoles.length === 0" @click="checkAllMenus">全选</el-button>
              <el-button link size="small" :disabled="checkedCount === 0" @click="clearMenus">清空</el-button>
            </span>
          </div>

          <el-table :data="candidateTree" row-key="menus_id" :tree-props="{ children: 'children' }" default-expand-all max-height="320" size="small" border class="menu-table">
            <el-table-column label="菜单名称" min-width="240">
              <template #default="{ row }">
                <span class="menu-node">
                  <span class="menu-name">{{ menuTitle(row) }}</span>
                  <el-tag v-if="row?.is_disabled" size="small" type="info" effect="plain">已禁用</el-tag>
                </span>
              </template>
            </el-table-column>

            <el-table-column label="类型" width="80" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="menuTypeTag(row?.type)" effect="light">{{ menuTypeLabel(row?.type) }}</el-tag>
              </template>
            </el-table-column>

            <el-table-column label="分配" width="70" align="center">
              <template #default="{ row }">
                <el-checkbox :model-value="isChecked(row?.menus_id)" :disabled="!canToggle(row?.menus_id)" @change="(value) => toggleChecked(row.menus_id, Boolean(value))" />
              </template>
            </el-table-column>

            <el-table-column v-if="canTransmit" width="90" align="center">
              <template #header>
                <el-tooltip content="勾上后，该账号可以把这条菜单继续分配给他的下级" placement="top">
                  <span class="th-tip">可下放</span>
                </el-tooltip>
              </template>
              <template #default="{ row }">
                <el-switch :model-value="isTransmit(row?.menus_id)" size="small" :disabled="!isChecked(row?.menus_id)" @change="(value) => toggleTransmit(row.menus_id, Boolean(value))" />
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!permLoading && candidateTree.length === 0" :description="permissionRoles.length === 0 ? '先选一个角色，菜单才会列出来' : '所选角色下没有你能分配的菜单'" :image-size="64" />
        </div>

        <p class="form-tip perm-tip">
          {{
            canTransmit
              ? "勾父级会连同子级一起勾上（可下放同步打开），只勾子级会自动补上上级；勾了「可下放」的菜单，该账号才能继续分配给他的下级。"
              : "你手上没有可下放的菜单，这里不能再开「可下放」。"
          }}
        </p>
      </div>

      <template #footer>
        <el-button @click="permVisible = false">取消</el-button>
        <el-button type="primary" :loading="permSaving" @click="submitPermission">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
  .user-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .user-head {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
    justify-content: space-between;
  }

  .user-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-text);
  }

  .user-desc {
    max-width: 720px;
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--app-text-3);
  }

  .user-toolbar {
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

  .cell-strong {
    font-size: 13px;
    font-weight: 500;
    color: var(--app-text);
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

  .role-tags {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .count-text {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--app-text-2);

    &.is-zero {
      color: var(--app-text-3);
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

  .action-cell {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    justify-content: center;
  }

  .user-form {
    padding-right: 12px;
  }

  .inline-field {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .form-tip {
    font-size: 12px;
    line-height: 1.5;
    color: var(--app-text-3);
  }

  .perm-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .perm-form {
    padding-right: 12px;
  }

  .perm-tip {
    margin: 0;
  }

  .field-full {
    width: 100%;
  }

  .role-option {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .role-option-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-option-count {
    font-size: 12px;
    color: var(--app-text-3);
  }

  .menu-panel {
    overflow: hidden;
    border: 1px solid var(--app-glass-border);
    border-radius: var(--app-radius);
    background: var(--app-glass);
  }

  .menu-tools {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--app-glass-border);
  }

  .menu-count {
    font-size: 12px;
    color: var(--app-text-3);

    b {
      font-variant-numeric: tabular-nums;
      color: var(--app-text);
    }
  }

  .menu-actions {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  .menu-table {
    width: 100%;
    border: none;

    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }
  }

  .menu-node {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .menu-name {
    overflow: hidden;
    font-size: 12.5px;
    color: var(--app-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .th-tip {
    font-size: 12px;
    color: var(--app-text-2);
    cursor: help;
    border-bottom: 1px dashed var(--app-glass-border);
  }
</style>
