<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { userApi } from "@/api/user";
import type { UserItem } from "@/types/user";

const props = defineProps<{ mode: "add" | "edit"; record: UserItem | null }>();
const emit = defineEmits<{ success: [] }>();
const visible = defineModel<boolean>({ required: true });

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = computed(() => props.mode === "edit");

const form = reactive({
  user_id: 0,
  account: "",
  nickname: "",
  password: "",
  status: "normal" as "normal" | "disabled",
  remark: "",
});

const rules = computed<FormRules>(() => ({
  account: [
    { required: true, message: "请输入账号", trigger: "blur" },
    { min: 3, max: 50, message: "账号长度 3-50 个字符", trigger: "blur" },
  ],
  nickname: [
    { required: true, message: "请输入昵称", trigger: "blur" },
    { max: 50, message: "昵称最多 50 个字符", trigger: "blur" },
  ],
  password: isEdit.value
    ? [{ min: 6, max: 128, message: "密码长度 6-128 个字符", trigger: "blur" }]
    : [
        { required: true, message: "请输入初始密码", trigger: "blur" },
        { min: 6, max: 128, message: "密码长度 6-128 个字符", trigger: "blur" },
      ],
  remark: [{ max: 255, message: "备注最多 255 个字符", trigger: "blur" }],
}));

watch(visible, (open) => {
  if (!open) return;
  formRef.value?.clearValidate();
  form.user_id = props.record?.user_id ?? 0;
  form.account = props.record?.account ?? "";
  form.nickname = props.record?.nickname ?? "";
  form.password = "";
  form.status = props.record?.status === "disabled" ? "disabled" : "normal";
  form.remark = props.record?.remark ?? "";
});

async function submit(): Promise<void> {
  const instance = formRef.value;
  if (!instance) return;

  const valid = await instance.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    if (isEdit.value) {
      await userApi.update({
        user_id: form.user_id,
        nickname: form.nickname.trim(),
        status: form.status,
        password: form.password || undefined,
        remark: form.remark.trim() || null,
      });
      ElMessage.success("保存成功");
    } else {
      await userApi.add({
        account: form.account.trim(),
        nickname: form.nickname.trim(),
        password: form.password,
        remark: form.remark.trim() || null,
      });
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
  <el-dialog v-model="visible" :title="isEdit ? '编辑账号' : '新增账号'" width="520px" :close-on-click-modal="false">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
      <el-form-item label="账号" prop="account">
        <el-input v-model="form.account" :disabled="isEdit" placeholder="3-50 个字符，用于登录" />
      </el-form-item>

      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="form.nickname" :maxlength="50" placeholder="展示用昵称" />
      </el-form-item>

      <el-form-item :label="isEdit ? '新密码' : '初始密码'" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          autocomplete="new-password"
          :placeholder="isEdit ? '留空表示不修改密码' : '6-128 位'"
        />
      </el-form-item>

      <el-form-item v-if="isEdit" label="状态">
        <div>
          <el-radio-group v-model="form.status">
            <el-radio-button value="normal">正常</el-radio-button>
            <el-radio-button value="disabled">禁用</el-radio-button>
          </el-radio-group>
          <div class="muted" style="margin-top: 6px; font-size: 12px">禁用或改密后，该账号已登录的会话会被立即清理</div>
        </div>
      </el-form-item>

      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="3" :maxlength="255" show-word-limit placeholder="可选" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>
