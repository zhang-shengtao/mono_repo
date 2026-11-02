<script setup lang="ts">
  import type { MenuBody, MenuMeta, MenuNode, MenuType, UpdateMenuBody } from "@repo/shared";
  import type { FormInstance, FormRules } from "element-plus";
  import { createMenu, deleteMenu, fetchMenuTree, updateMenu } from "@/api/menu";
  import { fetchCodeList, type CodeItem } from "@/api/code";
  defineOptions({ name: "systemMenu" });

  type BaseColumn = InstanceType<GlobalComponents["MyTable"]>["$props"]["columns"][number];
  type TableColumn<Row> = Omit<BaseColumn, "children" | "prop" | "formatter"> & {
    children?: TableColumn<Row>[];
    prop?: string | ((scope: { row: Row; column: any; $index: number }) => unknown);
    formatter?: (scope: { row: Row; column: any; $index: number }) => unknown;
  };

  type TagType = "info" | "success" | "warning";

  const TYPE_OPTIONS: { value: MenuType; label: string; tag: TagType }[] = [
    { value: "directory", label: "目录", tag: "info" },
    { value: "page", label: "页面", tag: "success" },
    { value: "button", label: "按钮", tag: "warning" },
  ];
  const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((item) => [item.value, item.label])) as Record<MenuType, string>;
  const TYPE_TAG = Object.fromEntries(TYPE_OPTIONS.map((item) => [item.value, item.tag])) as Record<MenuType, TagType>;
  /** 表格插槽里的 row 是 any，收口成两个取值函数，模板里就不必索引联合类型 */
  function typeLabel(type: MenuType) {
    return TYPE_LABEL[type] ?? "未知";
  }
  function typeTag(type: MenuType): TagType {
    return TYPE_TAG[type] ?? "info";
  }

  const columns: TableColumn<MenuNode>[] = [
    { label: "菜单名称", prop: (option) => option.row?.meta?.title || "未命名菜单", align: "left", minWidth: 240 },
    { label: "类型", slot: "type", width: 88 },
    { label: "权限码", slot: "permission", align: "left", minWidth: 210 },
    { label: "排序", prop: "sort", width: 74 },
    { label: "状态", slot: "status", width: 116 },
    { label: "操作", slot: "action", width: 220 },
  ];

  // ---------------- 列表 ----------------
  const loading = ref(false);
  const rows = ref<MenuNode[]>([]);
  const total = ref(0);
  const keyword = ref("");
  const typeFilter = ref<MenuType | "">("");
  const statusBusy = reactive(new Set<number>());

  /**
   * el-table-column 挂载时会用假作用域（row 为 {}）先跑一遍默认插槽来收集子列，
   * 所以插槽里读 row 必须容错，不能直接 row.meta.xxx。
   */
  function metaTitle(row?: { meta?: Partial<MenuMeta> | null }) {
    return row?.meta?.title || "未命名菜单";
  }

  function findNode(nodes: MenuNode[], menus_id: number): MenuNode | undefined {
    for (const node of nodes) {
      if (node.menus_id === menus_id) return node;
      const hit = findNode(node.children ?? [], menus_id);
      if (hit) return hit;
    }
    return undefined;
  }

  /** 节点自身 + 全部后代：上级选择器要排除它们，否则会挂成环 */
  function subtreeIds(nodes: MenuNode[], rootId: number | null) {
    const ids = new Set<number>();
    if (rootId === null) return ids;

    const walk = (node: MenuNode) => {
      ids.add(node.menus_id);
      (node.children ?? []).forEach(walk);
    };
    const root = findNode(nodes, rootId);
    if (root) walk(root);
    return ids;
  }

  async function loadTree() {
    loading.value = true;
    try {
      const result = await fetchMenuTree({ keyword: keyword.value.trim() || undefined, type: typeFilter.value || undefined });
      rows.value = result.list;
      total.value = result.total;
    } catch {
      // 请求层已统一提示
    } finally {
      loading.value = false;
    }
  }

  function search() {
    void loadTree();
  }

  /** 行内启用/禁用：复用整行编辑接口，服务端只认一份规则 */
  function buildUpdateBody(row: MenuNode, is_disabled: boolean): UpdateMenuBody {
    return {
      menus_id: row.menus_id,
      type: row.type,
      parent_id: row.parent_id,
      meta: row.meta,
      permission: row.permission,
      sort: row.sort,
      is_disabled,
    };
  }

  async function toggleStatus(row: MenuNode, enabled: boolean) {
    if (statusBusy.has(row.menus_id)) return;
    statusBusy.add(row.menus_id);
    try {
      await updateMenu(buildUpdateBody(row, !enabled));
      row.is_disabled = !enabled;
      ElMessage.success(enabled ? "已启用" : "已禁用");
    } catch {
      // 请求层已统一提示
    } finally {
      statusBusy.delete(row.menus_id);
    }
  }

  async function removeMenu(row: MenuNode) {
    if (row.children?.length) {
      ElMessage.warning("请先删除子级菜单");
      return;
    }

    try {
      await ElMessageBox.confirm(`确定删除「${metaTitle(row)}」吗？该菜单上已分配的用户授权会一并清理。`, "删除确认", {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      });
    } catch {
      return;
    }

    try {
      await deleteMenu(row.menus_id);
      ElMessage.success("已删除");
      await loadTree();
    } catch {
      // 请求层已统一提示
    }
  }

  // ---------------- 权限码 ----------------
  const codes = ref<CodeItem[]>([]);
  const codesLoading = ref(false);
  const codeMap = computed(() => new Map(codes.value.map((item) => [item.code, item])));

  async function loadCodes(force = false) {
    if (!force && codes.value.length > 0) return;
    codesLoading.value = true;
    try {
      codes.value = (await fetchCodeList()).list;
    } catch {
      codes.value = [];
    } finally {
      codesLoading.value = false;
    }
  }

  function codeOptionDisabled(item: CodeItem) {
    if (item.is_disabled) return true;
    return item.bind_menu_id !== null && item.bind_menu_id !== form.menus_id;
  }

  function codeTagText(item: CodeItem) {
    if (item.is_disabled) return "已禁用";
    if (item.bind_menu_id !== null) return item.bind_menu_id === form.menus_id ? "当前绑定" : `已绑定：${item.bind_menu_title ?? item.bind_menu_id}`;
    return "可绑定";
  }

  function codeTagType(item: CodeItem): TagType {
    if (item.is_disabled) return "info";
    if (item.bind_menu_id !== null) return "warning";
    return "success";
  }

  function permissionHint(permission: string | null) {
    if (!permission) return "";
    const item = codeMap.value.get(permission);
    return item ? `${item.name}${item.scope ? ` · ${item.scope}` : ""}` : "";
  }

  // ---------------- 上级菜单选项 ----------------
  const optionsTree = ref<MenuNode[]>([]);
  const optionsLoading = ref(false);

  async function loadOptions() {
    optionsLoading.value = true;
    try {
      optionsTree.value = (await fetchMenuTree()).list;
    } catch {
      optionsTree.value = [];
    } finally {
      optionsLoading.value = false;
    }
  }

  interface ParentOption {
    value: number;
    label: string;
    children?: ParentOption[];
  }

  /** 目录/页面只能挂顶级或目录下；按钮只能挂页面下 —— 上级选择器按当前类型实时切换 */
  const parentTreeData = computed<ParentOption[]>(() => {
    const excluded = subtreeIds(optionsTree.value, form.menus_id);
    if (form.type === "button") return pageOptions(optionsTree.value, "", excluded);
    return [{ value: 0, label: "顶级菜单", children: directoryOptions(optionsTree.value, excluded) }];
  });

  function directoryOptions(nodes: MenuNode[], excluded: Set<number>): ParentOption[] {
    return nodes
      .filter((node) => node.type === "directory" && !excluded.has(node.menus_id))
      .map((node) => ({ value: node.menus_id, label: metaTitle(node), children: directoryOptions(node.children ?? [], excluded) }));
  }

  function pageOptions(nodes: MenuNode[], prefix: string, excluded: Set<number>): ParentOption[] {
    const result: ParentOption[] = [];
    for (const node of nodes) {
      const label = prefix ? `${prefix} / ${metaTitle(node)}` : metaTitle(node);
      if (node.type === "page") {
        if (!excluded.has(node.menus_id)) result.push({ value: node.menus_id, label });
        continue;
      }
      if (node.type === "directory") result.push(...pageOptions(node.children ?? [], label, excluded));
    }
    return result;
  }

  // ---------------- 弹窗表单 ----------------
  function emptyForm() {
    return {
      menus_id: null as number | null,
      type: "directory" as MenuType,
      parent_id: 0,
      title: "",
      path: "",
      name: "",
      permission: null as string | null,
      sort: 0,
      is_disabled: false,
      keepAlive: false,
      isScreen: false,
      hidden: false,
      target: false,
      redirect: "",
    };
  }

  type MenuForm = ReturnType<typeof emptyForm>;

  const form = reactive<MenuForm>(emptyForm());
  const formRef = useTemplateRef<FormInstance>("formRef");
  const dialogVisible = ref(false);
  const dialogTitle = ref("");
  const submitting = ref(false);
  /** 编辑中且已有子级：类型锁死，避免出现「页面挂在页面下」这类非法树 */
  const editingHasChildren = ref(false);

  /** 类型可选项：上级已经是页面时，只可能是按钮 */
  const typeChoices = computed(() => {
    const parent = form.parent_id ? findNode(optionsTree.value, form.parent_id) : undefined;
    if (parent?.type === "page") return TYPE_OPTIONS.filter((item) => item.value === "button");
    return TYPE_OPTIONS;
  });

  const rules = computed<FormRules>(() => {
    const result: FormRules = {
      title: [{ required: true, message: "请输入名称", trigger: "blur" }],
      sort: [{ required: true, message: "请输入排序值", trigger: "change" }],
    };

    if (form.type !== "button") {
      result.path = [
        { required: true, message: "请输入路由路径，如 /system", trigger: "blur" },
        { pattern: /^\//, message: "路由路径必须以 / 开头", trigger: "blur" },
        { pattern: /^\S+$/, message: "路由路径不能包含空格", trigger: "blur" },
      ];
    }
    if (form.type === "page") {
      result.name = [
        { required: true, message: "请输入路由名，如 systemMenu", trigger: "blur" },
        { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: "路由名以字母开头，只能包含字母、数字、下划线和中划线", trigger: "blur" },
      ];
    }
    if (form.type === "button") {
      result.permission = [{ required: true, message: "按钮必须绑定权限码", trigger: "change" }];
    }
    return result;
  });

  watch(
    () => form.type,
    (type) => {
      if (type === "directory") form.permission = null;
      const parent = form.parent_id ? findNode(optionsTree.value, form.parent_id) : undefined;
      const expected = type === "button" ? "page" : "directory";
      if (parent && parent.type !== expected) form.parent_id = 0;
    },
  );

  watch(
    () => form.parent_id,
    (value) => {
      // 上级选择器点「清空」时是 undefined，统一收回成顶级 0
      if (!value) form.parent_id = 0;
    },
  );

  function resetForm() {
    Object.assign(form, emptyForm());
    editingHasChildren.value = false;
  }

  async function openCreate(parent?: MenuNode) {
    resetForm();
    form.parent_id = parent?.menus_id ?? 0;
    form.type = parent ? (parent.type === "page" ? "button" : "page") : "directory";
    dialogTitle.value = parent ? `新增${parent.type === "page" ? "按钮" : "子级"} · ${metaTitle(parent)}` : "新增顶级菜单";
    dialogVisible.value = true;
    await Promise.all([loadOptions(), loadCodes(true)]);
  }

  async function openEdit(row: MenuNode) {
    resetForm();
    dialogTitle.value = `编辑${TYPE_LABEL[row.type]}`;
    Object.assign(form, {
      menus_id: row.menus_id,
      type: row.type,
      parent_id: row.parent_id,
      title: row.meta.title,
      path: row.meta.path ?? "",
      name: row.meta.name ?? "",
      permission: row.permission,
      sort: row.sort,
      is_disabled: row.is_disabled,
      keepAlive: row.meta.keepAlive === true,
      isScreen: row.meta.isScreen === true,
      hidden: row.meta.hidden === true,
      target: row.meta.target === true,
      redirect: row.meta.redirect ?? "",
    });
    dialogVisible.value = true;
    await Promise.all([loadOptions(), loadCodes(true)]);
    // 表格行可能来自过滤后的树，子级数量以完整树为准
    editingHasChildren.value = (findNode(optionsTree.value, row.menus_id)?.children?.length ?? 0) > 0;
  }

  function buildMeta(): MenuMeta {
    const meta: MenuMeta = { title: form.title.trim() };
    if (form.type === "button") return meta;

    meta.path = form.path.trim();
    // 重定向只有目录用：目录点进去直接落到某个页面
    if (form.type === "directory") {
      if (form.redirect.trim()) meta.redirect = form.redirect.trim();
      return meta;
    }

    meta.name = form.name.trim();
    meta.keepAlive = form.keepAlive;
    meta.isScreen = form.isScreen;
    meta.hidden = form.hidden;
    meta.target = form.target;
    return meta;
  }

  async function submit() {
    if (form.type === "button" && !form.parent_id) {
      ElMessage.warning("按钮必须挂在页面下，请选择上级页面");
      return;
    }

    const valid = await formRef.value?.validate().catch(() => false);
    if (!valid) return;

    const body: MenuBody = {
      type: form.type,
      parent_id: form.parent_id,
      meta: buildMeta(),
      permission: form.type === "directory" ? null : form.permission?.trim() || null,
      sort: form.sort,
      is_disabled: form.is_disabled,
    };

    submitting.value = true;
    try {
      if (form.menus_id) await updateMenu({ ...body, menus_id: form.menus_id });
      else await createMenu(body);
      ElMessage.success(form.menus_id ? "已保存" : "已创建");
      dialogVisible.value = false;
      await loadTree();
    } catch {
      // 请求层已统一提示，弹窗保持打开方便修改
    } finally {
      submitting.value = false;
    }
  }

  function handleDialogClosed() {
    formRef.value?.clearValidate();
    resetForm();
  }

  onMounted(() => {
    void loadTree();
    void loadCodes();
  });
</script>

<template>
  <div class="menu-page">
    <header class="menu-head">
      <div>
        <h1 class="menu-title">菜单管理</h1>
        <p class="menu-desc">目录只做分组、不绑权限；页面只存路由配置，子级只能是按钮；按钮就是权限码的绑定对象。</p>
      </div>

      <div class="menu-toolbar">
        <el-input v-model="keyword" class="toolbar-search" clearable placeholder="名称 / 路径 / 权限码" @keyup.enter="search" @clear="search">
          <template #prefix><my-icon name="Search" :size="14" /></template>
        </el-input>

        <el-select v-model="typeFilter" class="toolbar-type" clearable placeholder="全部类型" @change="search">
          <el-option v-for="item in TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>

        <el-button @click="loadTree">
          <my-icon name="Refresh" :size="14" class="btn-icon" />
          刷新
        </el-button>

        <el-button type="primary" @click="openCreate()">
          <my-icon name="Plus" :size="14" class="btn-icon" />
          新增顶级菜单
        </el-button>
      </div>
    </header>

    <my-table v-loading="loading" :data="rows" :columns="columns" row-key="menus_id" :tree-props="{ children: 'children' }" :default-expand-all="true" size="small" border>
      <template #type="{ row }">
        <el-tag size="small" :type="typeTag(row.type)" effect="light">{{ typeLabel(row.type) }}</el-tag>
      </template>
      <template #permission="{ row }">
        <el-tooltip v-if="permissionHint(row.permission)" :content="permissionHint(row.permission)" placement="top">
          <code class="code-text">{{ row.permission }}</code>
        </el-tooltip>
        <code v-else-if="row.permission" class="code-text">{{ row.permission }}</code>
        <span v-else-if="row.type === 'button'" class="cell-muted">未绑定</span>
        <span v-else class="cell-muted">—</span>
      </template>
      <template #status="{ row }">
        <span class="status-cell">
          <el-switch :model-value="!row.is_disabled" size="small" :loading="statusBusy.has(row.menus_id)" @change="(value) => toggleStatus(row, Boolean(value))" />
          <span class="status-text">{{ row.is_disabled ? "已禁用" : "启用" }}</span>
        </span>
      </template>
      <template #action="{ row }">
        <span class="action-cell">
          <el-button v-if="row.type !== 'button'" link type="primary" size="small" @click="openCreate(row)">
            {{ row.type === "page" ? "加按钮" : "加子级" }}
          </el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-tooltip :disabled="!row.children?.length" content="请先删除子级菜单" placement="top">
            <span>
              <el-button link type="danger" size="small" :disabled="Boolean(row.children?.length)" @click="removeMenu(row)">删除</el-button>
            </span>
          </el-tooltip>
        </span>
      </template>
      <template #empty>
        <el-empty description="暂无菜单，先新增一个目录吧" :image-size="80" />
      </template>
    </my-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" top="8vh" draggable :close-on-click-modal="false" append-to-body @closed="handleDialogClosed">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="98px" class="menu-form">
        <el-form-item label="菜单类型" prop="type">
          <span class="inline-field">
            <el-radio-group v-model="form.type" :disabled="editingHasChildren">
              <el-radio-button v-for="item in typeChoices" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button>
            </el-radio-group>
            <span v-if="editingHasChildren" class="form-tip">已有子级，不能修改类型</span>
          </span>
        </el-form-item>

        <el-form-item label="上级菜单" prop="parent_id">
          <el-tree-select
            v-model="form.parent_id"
            :data="parentTreeData"
            :props="{ label: 'label', children: 'children' }"
            :loading="optionsLoading"
            check-strictly
            filterable
            default-expand-all
            placeholder="顶级菜单"
            class="field-full"
          />
        </el-form-item>

        <el-form-item :label="`${TYPE_LABEL[form.type]}名称`" prop="title">
          <el-input v-model="form.title" maxlength="30" show-word-limit placeholder="请输入名称" />
        </el-form-item>

        <el-form-item v-if="form.type !== 'button'" label="路由路径" prop="path">
          <el-input v-model="form.path" :placeholder="form.type === 'directory' ? '如 /system' : '如 /system/menu'" />
        </el-form-item>

        <el-form-item v-if="form.type === 'directory'" label="重定向" prop="redirect">
          <el-input v-model="form.redirect" clearable placeholder="可选，目录默认落到哪个页面，如 /system/menu" />
        </el-form-item>

        <el-form-item v-if="form.type === 'page'" label="路由名" prop="name">
          <el-input v-model="form.name" placeholder="如 systemMenu（keep-alive 依赖）" />
        </el-form-item>

        <el-form-item v-if="form.type !== 'directory'" label="权限码" prop="permission">
          <el-select
            v-model="form.permission"
            class="field-full"
            filterable
            clearable
            :loading="codesLoading"
            :placeholder="form.type === 'button' ? '按钮必须绑定权限码' : '可选：绑定页面级权限码'"
          >
            <el-option v-for="item in codes" :key="item.code" :label="item.code" :value="item.code" :disabled="codeOptionDisabled(item)">
              <span class="code-option">
                <code class="code-text">{{ item.code }}</code>
                <span class="code-option-name">{{ item.name }}</span>
                <el-tag size="small" :type="codeTagType(item)" effect="plain">{{ codeTagText(item) }}</el-tag>
              </span>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item v-else label="权限码">
          <span class="form-tip">目录只做分组，不绑定权限码；权限由下面的页面 / 按钮各自持有</span>
        </el-form-item>

        <div class="field-row">
          <el-form-item label="排序" prop="sort" class="field-row-item">
            <el-input-number v-model="form.sort" class="field-full" :min="0" :max="9999" controls-position="right" />
          </el-form-item>

          <el-form-item label="状态" class="field-row-item">
            <el-switch :model-value="!form.is_disabled" active-text="启用" inactive-text="禁用" inline-prompt @change="(value) => (form.is_disabled = !value)" />
          </el-form-item>
        </div>

        <el-form-item v-if="form.type === 'page'" label="页面配置">
          <span class="check-group">
            <el-checkbox v-model="form.keepAlive">keep-alive 缓存</el-checkbox>
            <el-checkbox v-model="form.isScreen">占满内容区</el-checkbox>
            <el-checkbox v-model="form.hidden">不进菜单 / 页签</el-checkbox>
            <el-checkbox v-model="form.target">新窗口打开</el-checkbox>
          </span>
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
  .menu-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .menu-head {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-end;
    justify-content: space-between;
  }

  .menu-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-text);
  }

  .menu-desc {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: var(--app-text-3);
  }

  .menu-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .toolbar-search {
    width: 214px;
  }

  .toolbar-type {
    width: 128px;
  }

  .btn-icon {
    margin-right: 4px;
    vertical-align: -2px;
  }

  .row-title {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    max-width: 100%;
  }

  .row-title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-text {
    font-size: 12.5px;
    color: var(--app-text-2);
  }

  .cell-muted {
    font-size: 12px;
    color: var(--app-text-3);
  }

  .code-text {
    padding: 1px 6px;
    font-family: ui-monospace, sfmono-regular, menlo, monospace;
    font-size: 12px;
    color: var(--app-primary);
    background-color: color-mix(in srgb, var(--app-primary) 10%, transparent);
    border-radius: 5px;
  }

  .status-cell {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }

  .status-text {
    font-size: 12px;
    color: var(--app-text-3);
  }

  .action-cell {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    justify-content: center;
  }

  .menu-form {
    padding-right: 12px;
  }

  .field-full {
    width: 100%;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
  }

  .field-row-item {
    min-width: 0;
  }

  .inline-field {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .check-group {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    align-items: center;
  }

  .form-tip {
    font-size: 12px;
    line-height: 1.5;
    color: var(--app-text-3);
  }

  .code-option {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .code-option-name {
    flex: 1;
    overflow: hidden;
    font-size: 12px;
    color: var(--app-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
