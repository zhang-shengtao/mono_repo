<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { menuApi } from "@/api/menu";
import IconPicker from "@/components/IconPicker.vue";
import type { PermissionCodeItem } from "@/types/code";
import type { MenuNode, MenuType } from "@/types/menu";
import { MENU_TYPE_LABEL } from "@/utils/dict";
import { buildMenuSelectOptions, flattenMenus } from "@/utils/menu";

const props = defineProps<{
  mode: "add" | "edit";
  record: MenuNode | null;
  /** 新增子级时带过来的父级；新增根节点传 0 */
  presetParentId: number;
  tree: MenuNode[];
  codes: PermissionCodeItem[];
}>();

const emit = defineEmits<{ success: [] }>();
const visible = defineModel<boolean>({ required: true });

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = computed(() => props.mode === "edit");

const form = reactive({
  admin_menus_id: 0,
  type: "directory" as MenuType,
  parent_id: 0,
  title: "",
  path: "",
  name: "",
  icon: "",
  permission: null as string | null,
  sort: 0,
  is_disabled: false,
});

function parentTypeOf(parentId: number): MenuType | null {
  if (parentId === 0) return null;
  return flattenMenus(props.tree).find((node) => node.admin_menus_id === parentId)?.type ?? null;
}

/** 父级类型决定当前节点能是什么类型：按钮的父级必须是页面 */
const parentType = computed(() => parentTypeOf(form.parent_id));
const allowedTypes = computed<MenuType[]>(() => (parentType.value === "page" ? ["button"] : ["directory", "page"]));

/** 父级候选：按钮只能挂在页面下；目录/页面只能挂在目录下（或顶级） */
const parentSelectData = computed(() => {
  const excludeId = isEdit.value ? form.admin_menus_id : undefined;
  if (form.type === "button") {
    return buildMenuSelectOptions(props.tree, "page", excludeId);
  }
  const directories = buildMenuSelectOptions(props.tree, "directory", excludeId);
  return [{ value: 0, label: "顶级菜单", children: directories }];
});

/** 可绑定的权限码：未被占用的，或当前菜单已经占用的那条 */
const permissionOptions = computed(() => {
  const ownId = form.admin_menus_id;
  return props.codes
    .filter((item) => item.bind_menu_id === null || item.bind_menu_id === ownId)
    .map((item) => ({ value: item.code, label: `${item.name}（${item.code}）` }));
});

const rules = computed<FormRules>(() => {
  const result: FormRules = {
    title: [
      { required: true, message: "请输入菜单名称", trigger: "blur" },
      { max: 50, message: "名称最多 50 个字符", trigger: "blur" },
    ],
  };

  if (form.type !== "button") {
    result.path = [
      { required: true, message: "请输入路由路径", trigger: "blur" },
      { pattern: /^\/[^\s]*$/, message: "路径必须以 / 开头，且不能包含空格", trigger: "blur" },
    ];
    result.name = [
      { required: true, message: "请输入路由名称", trigger: "blur" },
      { pattern: /^[A-Za-z][\w-]*$/, message: "建议用英文，例如 SystemUser", trigger: "blur" },
    ];
  }

  if (form.type === "button") {
    result.parent_id = [
      {
        validator: (_rule, value, callback) => {
          if (!value || Number(value) <= 0) callback(new Error("按钮必须挂在某个页面下"));
          else callback();
        },
        trigger: "change",
      },
    ];
    result.permission = [{ required: true, message: "按钮必须绑定权限码", trigger: "change" }];
  }

  return result;
});

watch(visible, (open) => {
  if (!open) return;
  formRef.value?.clearValidate();

  const record = props.record;
  const presetParent = record?.parent_id ?? props.presetParentId;
  const presetParentType = parentTypeOf(presetParent);

  form.admin_menus_id = record?.admin_menus_id ?? 0;
  form.parent_id = presetParent;
  form.type = record?.type ?? (presetParentType === "page" ? "button" : presetParent === 0 ? "directory" : "page");
  form.title = String(record?.meta?.title ?? "");
  form.path = String(record?.meta?.path ?? "");
  form.name = String(record?.meta?.name ?? "");
  form.icon = String(record?.meta?.icon ?? "");
  form.permission = record?.permission ?? null;
  form.sort = record?.sort ?? 0;
  form.is_disabled = record?.is_disabled ?? false;
});

// 切类型时顺手修正不合法的父级，避免提交后才被后端打回
watch(
  () => form.type,
  (type) => {
    const currentParentType = parentTypeOf(form.parent_id);
    if (type === "button" && currentParentType !== "page") form.parent_id = 0;
    if (type !== "button" && currentParentType === "page") form.parent_id = 0;
    if (type === "directory") form.permission = null;
  },
);

async function submit(): Promise<void> {
  const instance = formRef.value;
  if (!instance) return;

  const valid = await instance.validate().catch(() => false);
  if (!valid) return;

  const meta: Record<string, unknown> = { title: form.title.trim() };
  if (form.type !== "button") {
    meta.path = form.path.trim();
    meta.name = form.name.trim();
    if (form.icon) meta.icon = form.icon;
  }

  const payload = {
    type: form.type,
    parent_id: form.parent_id,
    meta,
    permission: form.type === "directory" ? null : form.permission,
    sort: form.sort,
    is_disabled: form.is_disabled,
  };

  submitting.value = true;
  try {
    if (isEdit.value) {
      await menuApi.update({ ...payload, admin_menus_id: form.admin_menus_id });
      ElMessage.success("保存成功");
    } else {
      await menuApi.create(payload);
      ElMessage.success("新增成功");
    }
    visible.value = false;
    emit("success");
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="isEdit ? '编辑菜单' : '新增菜单'" width="600px" :close-on-click-modal="false">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="form.type">
          <el-radio-button v-for="type in allowedTypes" :key="type" :value="type">
            {{ MENU_TYPE_LABEL[type] }}
          </el-radio-button>
        </el-radio-group>
        <div class="muted" style="width: 100%; margin-top: 6px; font-size: 12px">
          目录只做分组，页面才生成路由，按钮用于挂权限码
        </div>
      </el-form-item>

      <el-form-item label="父级" prop="parent_id">
        <el-tree-select
          v-model="form.parent_id"
          :data="parentSelectData"
          node-key="value"
          :props="{ label: 'label', children: 'children' }"
          check-strictly
          default-expand-all
          :render-after-expand="false"
          :clearable="form.type !== 'button'"
          placeholder="选择父级菜单"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="名称" prop="title">
        <el-input v-model="form.title" :maxlength="50" placeholder="展示在侧边栏 / 面包屑的名字" />
      </el-form-item>

      <template v-if="form.type !== 'button'">
        <el-form-item label="路由路径" prop="path">
          <el-input v-model="form.path" placeholder="例如 /system/user，必须以 / 开头" />
        </el-form-item>

        <el-form-item label="路由名称" prop="name">
          <el-input v-model="form.name" placeholder="全局唯一，例如 SystemUser" />
        </el-form-item>

        <el-form-item label="图标">
          <IconPicker v-model="form.icon" />
        </el-form-item>
      </template>

      <el-form-item v-if="form.type !== 'directory'" label="权限码" prop="permission">
        <el-select
          v-model="form.permission"
          filterable
          clearable
          placeholder="选择要绑定的权限码"
          style="width: 100%"
          :no-data-text="'没有可绑定的权限码，先跑 db:seed:permissions 同步种子'"
        >
          <el-option v-for="item in permissionOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <div class="muted" style="width: 100%; margin-top: 6px; font-size: 12px">
          页面的权限码决定「能不能进这个路由」，按钮的权限码决定「页面里能不能点」
        </div>
      </el-form-item>

      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        <span class="muted" style="margin-left: 10px; font-size: 12px">数字越小越靠前</span>
      </el-form-item>

      <el-form-item label="禁用">
        <el-switch v-model="form.is_disabled" />
        <span class="muted" style="margin-left: 10px; font-size: 12px">禁用后不会出现在侧边栏</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>
