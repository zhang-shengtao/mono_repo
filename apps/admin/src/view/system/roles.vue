<script setup lang="ts">
  import type { MenuNode, RoleItem, RoleMenuScope } from "@repo/shared";
  import type { FormInstance, FormRules } from "element-plus";
  import { createRole, deleteRole, fetchRoleList, fetchRoleMenuScope, updateRole } from "@/api/role";
  import { usePerms, type RouteMenuProps } from "@/utils/perms";
  /**
   * 角色管理
   * name 必须与 route.name 一致，否则 keep-alive 静默失效。
   */
  defineOptions({ name: "systemRoles" });

  // 动态路由会把当前菜单节点与按钮节点作为 props 传进来
  defineProps<RouteMenuProps>();

  /** 按钮权限：权限码来自菜单管理里配的按钮节点，没配就不渲染 */
  const { has } = usePerms();

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

  const columns: TableColumn<RoleItem>[] = [
    { label: "角色名称", slot: "name", minWidth: 170 },
    { label: "描述", slot: "description", minWidth: 230 },
    { label: "菜单", slot: "menus", width: 96, align: "center" },
    { label: "已分配", slot: "assigned", width: 96, align: "center" },
    { label: "状态", slot: "status", width: 118 },
    { label: "归属人", slot: "owner", width: 130 },
    { label: "更新时间", slot: "updated", width: 140 },
    { label: "操作", slot: "action", width: 110, fixed: "right" },
  ];

  // ---------------- 列表 ----------------
  const loading = ref(false);
  const roles = ref<RoleItem[]>([]);
  const keyword = ref("");
  const statusFilter = ref<StatusFilter>("");
  const statusBusy = reactive(new Set<number>());

  /**
   * 角色是随管理需要维护的有限集合（几十个），一次拉全量、本地过滤：
   * 搜索 / 状态切换都不用再打接口，统计数字也不会随筛选条件变形。
   * 服务端仍支持 keyword / is_disabled 过滤，供其他调用方按需使用。
   */
  const rows = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    return roles.value.filter((item) => {
      if (statusFilter.value === "enabled" && item.is_disabled) return false;
      if (statusFilter.value === "disabled" && !item.is_disabled) return false;
      if (!kw) return true;
      return [item.roles_name, item.roles_description ?? "", item.created_by_name ?? ""].some((value) => value.toLowerCase().includes(kw));
    });
  });

  const hasFilter = computed(() => Boolean(keyword.value.trim() || statusFilter.value));

  function resetFilters() {
    keyword.value = "";
    statusFilter.value = "";
  }

  async function loadList() {
    loading.value = true;
    try {
      roles.value = (await fetchRoleList()).list;
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false;
    }
  }

  // ---------------- 启用 / 禁用 ----------------
  /**
   * 行内启停：复用整行编辑接口，服务端只认一份规则。
   * 禁用不会动 role_menus 与 permissions，重新启用即复原。
   */
  async function toggleStatus(row: RoleItem, enabled: boolean) {
    if (statusBusy.has(row.roles_id)) return;

    if (!enabled && row.user_count > 0) {
      try {
        await ElMessageBox.confirm(`该角色已分配给 ${row.user_count} 个账号，禁用后他们将立刻失去这组菜单权限。确定禁用「${row.roles_name}」吗？`, "禁用确认", {
          type: "warning",
          confirmButtonText: "禁用",
          cancelButtonText: "取消",
        });
      } catch {
        return;
      }
    }

    statusBusy.add(row.roles_id);
    try {
      const updated = await updateRole({
        roles_id: row.roles_id,
        roles_name: row.roles_name,
        roles_description: row.roles_description,
        is_disabled: !enabled,
        menus_id: row.menus_id,
        transmit_menus_id: row.transmit_menus_id,
      });
      Object.assign(row, updated);
      ElMessage.success(enabled ? "已启用" : "已禁用");
    } catch {
      // 请求层已统一提示，开关保持原状态
    } finally {
      statusBusy.delete(row.roles_id);
    }
  }

  // ---------------- 删除 ----------------
  async function removeRole(row: RoleItem) {
    const impact = row.user_count > 0 ? `该角色已分配给 ${row.user_count} 个账号，删除后他们的这组菜单权限会一并收回。` : "";
    try {
      await ElMessageBox.confirm(`${impact}确定删除「${row.roles_name}」吗？此操作不可撤销。`, "删除确认", {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      });
    } catch {
      return;
    }

    try {
      await deleteRole(row.roles_id);
      ElMessage.success("已删除");
      await loadList();
    } catch {
      // 请求层已统一提示
    }
  }

  // ---------------- 菜单权限（表格） ----------------
  /**
   * 菜单不再用 el-tree：表格能一列列摆出「类型 / 权限码 / 分配 / 可下放」，
   * 尤其 is_transmit（可下放）这种按行独立的开关，树控件没有地方放。
   * 可分配范围由后端按登录人算：超管看全量，二级管理员只看自己「可下放」的菜单。
   */
  const menuScope = ref<RoleMenuScope | null>(null);
  const menuTree = ref<MenuNode[]>([]);
  const menuLoading = ref(false);
  /** 已勾「分配」的菜单；角色原有的菜单也会带进来，可能含当前不可分配的（只读展示） */
  const checkedMenus = ref<number[]>([]);
  /** 已勾「可下放」的菜单 */
  const transmitMenus = ref<number[]>([]);
  /** menus_id → parent_id，保存时用来补上级 */
  const menuParent = new Map<number, number>();
  /** menus_id → 直接子级 ID，勾选联动用 */
  const menuChildren = new Map<number, number[]>();

  const assignableSet = computed(() => new Set(menuScope.value?.assignable ?? []));
  /** 手上有可下放的菜单，就能决定「传下去时要不要继续保持可下放」—— 下放逐级传递，每级由上一级决定 */
  const canTransmit = computed(() => menuScope.value?.can_transmit ?? false);
  /** 空态文案分两种：手上没菜单（是权限问题）和菜单表真空（是配置问题），别让人去翻菜单管理 */
  const emptyMenuTip = computed(() => (canTransmit.value ? "没有可分配的菜单，先去菜单管理里建" : "你手上没有可下放的菜单，请让上级先下放给你"));
  const checkedCount = computed(() => checkedMenus.value.length);

  async function loadMenuScope() {
    menuLoading.value = true;
    try {
      const result = await fetchRoleMenuScope();
      menuScope.value = result;
      menuTree.value = result.list;
      menuParent.clear();
      menuChildren.clear();
      indexTree(result.list, 0);
    } catch {
      menuScope.value = null;
      menuTree.value = [];
    } finally {
      menuLoading.value = false;
    }
  }

  function indexTree(nodes: MenuNode[], parentId: number) {
    for (const node of nodes) {
      menuParent.set(node.menus_id, parentId);
      menuChildren.set(
        node.menus_id,
        (node.children ?? []).map((child) => child.menus_id),
      );
      if (node.children?.length) indexTree(node.children, node.menus_id);
    }
  }

  /** 某菜单的全部后代（不含自己），按表格树顺序 */
  function descendantIds(menus_id: number) {
    const result: number[] = [];
    const walk = (id: number) => {
      for (const child of menuChildren.get(id) ?? []) {
        result.push(child);
        walk(child);
      }
    };
    walk(menus_id);
    return result;
  }

  /** 某菜单的全部祖先（由近到远） */
  function ancestorIds(menus_id: number) {
    const result: number[] = [];
    let cursor = menuParent.get(menus_id) ?? 0;
    while (cursor) {
      result.push(cursor);
      cursor = menuParent.get(cursor) ?? 0;
    }
    return result;
  }

  function isAssignable(menus_id?: number) {
    return menus_id !== undefined && assignableSet.value.has(menus_id);
  }

  function isChecked(menus_id?: number) {
    return menus_id !== undefined && checkedMenus.value.includes(menus_id);
  }

  /** 已分配的菜单允许取消（哪怕它已经禁用），未分配的禁用菜单不能勾 */
  function canToggle(menus_id?: number) {
    return isAssignable(menus_id) || isChecked(menus_id);
  }

  function isTransmit(menus_id?: number) {
    return menus_id !== undefined && transmitMenus.value.includes(menus_id);
  }

  /** 批量勾上：只认能勾的（可分配，或本来就已经勾着的），并同步打开「可下放」 */
  function applyChecked(ids: number[]) {
    const next = new Set(checkedMenus.value);
    for (const id of ids) {
      if (assignableSet.value.has(id) || next.has(id)) next.add(id);
    }
    checkedMenus.value = [...next].sort((a, b) => a - b);

    if (!canTransmit.value) return;
    const transmit = new Set(transmitMenus.value);
    for (const id of ids) {
      if (next.has(id)) transmit.add(id);
    }
    transmitMenus.value = [...transmit].sort((a, b) => a - b);
  }

  /**
   * 勾选联动（表格没有 el-tree 的父子联动，得自己算）：
   *   勾上父级 → 子级全部跟着勾上，「可下放」也一起打开
   *   勾上子级 → 祖先一起补上（否则角色里只有按钮、没有所在页面，菜单树是断的）
   *   取消父级 → 子级全部取消
   *   取消子级 → 祖先若已经没有任何被勾的子级，也一起取消（兄弟还勾着就留着）
   */
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

  /** 全选：分配全勾上，「可下放」也一起勾上（手上有可下放菜单的账号都能开） */
  function checkAllMenus() {
    const assignable = [...assignableSet.value].sort((a, b) => a - b);
    // 角色里已有的菜单可能不在可分配范围（已禁用等），全选时保留，不能被顺手清掉
    checkedMenus.value = [...new Set([...checkedMenus.value, ...assignable])].sort((a, b) => a - b);
    if (canTransmit.value) transmitMenus.value = [...assignable];
  }

  function clearMenus() {
    checkedMenus.value = [];
    transmitMenus.value = [];
  }

  /**
   * 补齐上级：只补「可分配」的祖先。
   * 二级管理员的祖先可能只是分组节点、并不归他分配，补上去后端会直接拒绝。
   */
  function withAncestors(ids: number[]) {
    const result = new Set(ids);
    for (const id of ids) {
      let cursor = menuParent.get(id);
      while (cursor) {
        if (assignableSet.value.has(cursor)) result.add(cursor);
        cursor = menuParent.get(cursor);
      }
    }
    return [...result].sort((a, b) => a - b);
  }

  /** 表格插槽里的 row 是 any（挂载时还会先用假作用域跑一遍），取值一律容错 */
  function menuTitle(row?: Partial<MenuNode>) {
    return row?.meta?.title || "未命名菜单";
  }

  const MENU_TYPE_LABEL = { directory: "目录", page: "页面", button: "按钮" } as const;

  function menuTypeLabel(type?: MenuNode["type"]) {
    return type ? MENU_TYPE_LABEL[type] : "—";
  }

  function menuTypeTag(type?: MenuNode["type"]) {
    return type === "page" ? "success" : type === "button" ? "warning" : "info";
  }

  // ---------------- 弹窗表单 ----------------
  function emptyForm() {
    return {
      roles_id: null as number | null,
      roles_name: "",
      roles_description: "",
      is_disabled: false,
    };
  }

  type RoleForm = ReturnType<typeof emptyForm>;

  const form = reactive<RoleForm>(emptyForm());
  const formRef = useTemplateRef<FormInstance>("formRef");
  const dialogVisible = ref(false);
  const dialogTitle = ref("");
  const submitting = ref(false);

  const rules: FormRules = {
    roles_name: [
      { required: true, message: "请输入角色名称", trigger: "blur" },
      { max: 30, message: "角色名称最多 30 个字符", trigger: "blur" },
    ],
  };

  function resetForm() {
    formRef.value?.clearValidate();
    Object.assign(form, emptyForm());
    clearMenus();
  }

  async function openDialog(role: RoleItem | null) {
    resetForm();
    if (role) {
      Object.assign(form, {
        roles_id: role.roles_id,
        roles_name: role.roles_name,
        roles_description: role.roles_description ?? "",
        is_disabled: role.is_disabled,
      });
      dialogTitle.value = `编辑角色 · ${role.roles_name}`;
    } else {
      dialogTitle.value = "新增角色";
    }

    dialogVisible.value = true;
    await loadMenuScope();
    // 回填用 ID 数组驱动，表格渲染顺序无关，不需要等 DOM
    checkedMenus.value = [...(role?.menus_id ?? [])];
    transmitMenus.value = [...(role?.transmit_menus_id ?? [])];
  }

  async function submit() {
    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;

    const body = {
      roles_name: form.roles_name.trim(),
      roles_description: form.roles_description.trim() || null,
      is_disabled: form.is_disabled,
      menus_id: withAncestors(checkedMenus.value),
      transmit_menus_id: transmitMenus.value.filter((id) => checkedMenus.value.includes(id)),
    };

    submitting.value = true;
    try {
      if (form.roles_id) await updateRole({ ...body, roles_id: form.roles_id });
      else await createRole(body);
      ElMessage.success(form.roles_id ? "已保存" : "已创建");
      dialogVisible.value = false;
      await loadList();
    } catch {
      // 请求层已统一提示，弹窗保持打开方便修改
    } finally {
      submitting.value = false;
    }
  }

  // ---------------- 展示辅助 ----------------
  /**
   * el-table-column 挂载时会用假作用域（row 为 {}）先跑一遍默认插槽来收集子列，
   * 所以插槽里读 row 必须容错，不能直接 row.menus_id.length。
   */
  function menuCount(row?: Partial<RoleItem>) {
    return row?.menus_id?.length ?? 0;
  }

  function assignedCount(row?: Partial<RoleItem>) {
    return row?.user_count ?? 0;
  }

  function ownerName(row?: Partial<RoleItem>) {
    if (!row?.created_by) return "—";
    return row.created_by_name ?? `用户 ${row.created_by}`;
  }

  /** 库里是 timestamp 字符串（2026-11-02 17:02:28.123），表格只显示到分钟 */
  function formatTime(value?: string | null) {
    if (!value) return "—";
    return String(value).replace("T", " ").slice(0, 16);
  }

  onMounted(() => {
    void loadList();
  });
</script>

<template>
  <div class="role-page">
    <header class="role-head">
      <div>
        <h1 class="role-title">角色管理</h1>
        <p class="role-desc">角色是一份可复用的菜单权限模板：先在这里勾好菜单，再去用户管理里分配给下级账号。</p>
        <p class="role-desc">角色与用户解耦，改一次菜单，所有持有该角色的账号同步生效；禁用或删除会让这些账号立刻失去对应权限。</p>
      </div>

      <div class="role-toolbar">
        <el-input v-model="keyword" class="toolbar-search" clearable placeholder="角色名称 / 描述 / 归属人">
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

        <el-button v-if="has('system:role:add')" type="primary" @click="openDialog(null)">
          <my-icon name="Plus" :size="14" class="btn-icon" />
          新增角色
        </el-button>
      </div>
    </header>

    <my-table v-loading="loading" :data="rows" :columns="columns" row-key="roles_id" size="small" border>
      <template #name="{ row }">
        <span class="role-name">
          <span class="cell-strong ellipsis">{{ row.roles_name }}</span>
          <el-tag v-if="row.is_disabled" size="small" type="info" effect="plain">已禁用</el-tag>
        </span>
      </template>

      <template #description="{ row }">
        <el-tooltip v-if="row.roles_description" :content="row.roles_description" placement="top" :show-after="400">
          <span class="cell-text ellipsis">{{ row.roles_description }}</span>
        </el-tooltip>
        <span v-else class="cell-muted">未填写</span>
      </template>

      <template #menus="{ row }">
        <el-tooltip :content="`角色包含 ${menuCount(row)} 个菜单`" placement="top" :show-after="400">
          <span class="count-text">{{ menuCount(row) }}</span>
        </el-tooltip>
      </template>

      <template #assigned="{ row }">
        <span class="count-text" :class="{ 'is-zero': assignedCount(row) === 0 }">{{ assignedCount(row) }}</span>
      </template>

      <template #status="{ row }">
        <span class="status-cell">
          <el-switch
            :model-value="!row.is_disabled"
            size="small"
            :loading="statusBusy.has(row.roles_id)"
            :disabled="statusBusy.has(row.roles_id)"
            @change="(value) => toggleStatus(row, Boolean(value))"
          />
          <span class="status-text" :class="{ 'is-off': row.is_disabled }">{{ row.is_disabled ? "已禁用" : "启用中" }}</span>
        </span>
      </template>

      <template #owner="{ row }">
        <span class="cell-text ellipsis">{{ ownerName(row) }}</span>
      </template>

      <template #updated="{ row }">
        <span class="time-text">{{ formatTime(row.updated_at) }}</span>
      </template>

      <template #action="{ row }">
        <span class="action-cell">
          <el-button v-if="has('system:role:put')" link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button v-if="has('system:role:delete')" link type="danger" size="small" @click="removeRole(row)">删除</el-button>
        </span>
      </template>

      <template #empty>
        <el-empty :description="roles.length > 0 ? '没有匹配的角色，试试换个关键词或清空筛选' : '还没有角色，先建一个再分配给下级账号'" :image-size="80">
          <el-button v-if="hasFilter" size="small" @click="resetFilters">清空筛选</el-button>
        </el-empty>
      </template>
    </my-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="780px" top="8vh" draggable :close-on-click-modal="false" append-to-body @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" class="role-form">
        <el-form-item label="角色名称" prop="roles_name">
          <el-input v-model="form.roles_name" maxlength="30" show-word-limit placeholder="如 运营、财务审核" />
        </el-form-item>

        <el-form-item label="描述" prop="roles_description">
          <el-input v-model="form.roles_description" type="textarea" :rows="2" maxlength="255" show-word-limit resize="none" placeholder="这个角色是干什么的、给谁用" />
        </el-form-item>

        <el-form-item label="状态">
          <span class="inline-field">
            <el-switch :model-value="!form.is_disabled" active-text="启用" inactive-text="禁用" inline-prompt @change="(value) => (form.is_disabled = !value)" />
            <span class="form-tip">禁用后持有该角色的账号会立刻失去这组菜单权限</span>
          </span>
        </el-form-item>

        <el-form-item label="菜单权限">
          <div v-loading="menuLoading" class="menu-panel">
            <div class="menu-tools">
              <span class="menu-count">
                已选
                <b>{{ checkedCount }}</b>
                项
                <template v-if="canTransmit && transmitMenus.length > 0">（{{ transmitMenus.length }} 项可下放）</template>
              </span>
              <span class="menu-actions">
                <el-button link type="primary" size="small" @click="checkAllMenus">全选</el-button>
                <el-button link size="small" :disabled="checkedCount === 0" @click="clearMenus">清空</el-button>
              </span>
            </div>

            <el-table :data="menuTree" row-key="menus_id" :tree-props="{ children: 'children' }" default-expand-all max-height="300" size="small" border class="menu-table">
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
                  <el-tooltip content="勾上后，持有该角色的下级管理员可以把这个菜单继续分配给他的下级" placement="top">
                    <span class="th-tip">可下放</span>
                  </el-tooltip>
                </template>
                <template #default="{ row }">
                  <el-switch :model-value="isTransmit(row?.menus_id)" size="small" :disabled="!isChecked(row?.menus_id)" @change="(value) => toggleTransmit(row.menus_id, Boolean(value))" />
                </template>
              </el-table-column>
            </el-table>

            <el-empty v-if="!menuLoading && menuTree.length === 0" :description="emptyMenuTip" :image-size="64" />
          </div>
          <p class="form-tip tree-tip">
            {{ canTransmit ? "勾父级会连同子级一起勾上（可下放同步打开），只勾子级会自动补上上级；勾了「可下放」的菜单，持有该角色的账号才能继续分配给他的下级。" : "你手上没有可下放的菜单，暂时无法分配权限，请让上级先把菜单下放给你。" }}
          </p>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
  .role-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .role-head {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
    justify-content: space-between;
  }

  .role-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-text);
  }

  .role-desc {
    max-width: 680px;
    margin: 4px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--app-text-3);
  }

  .role-toolbar {
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

  .role-name {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    max-width: 100%;
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

  .role-form {
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

  .menu-panel {
    width: 100%;
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

  .tree-tip {
    margin: 6px 0 0;
  }
</style>
