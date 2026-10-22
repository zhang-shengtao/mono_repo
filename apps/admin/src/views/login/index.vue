<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Grid, Key, Lock, User, UserFilled } from "@element-plus/icons-vue";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const captchaSvg = ref("");
const captchaId = ref("");
const captchaLoading = ref(false);
const captchaError = ref("");
const submitting = ref(false);
const errorMessage = ref("");

const form = reactive({ username: "", password: "", code: "" });

const rules: FormRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 128, message: "密码长度 6-128 位", trigger: "blur" },
  ],
  code: [{ required: true, message: "请输入验证码", trigger: "blur" }],
};

/** 验证码在 Redis 里是一次性的：每次失败都要重新拉一张 */
async function loadCaptcha(): Promise<void> {
  captchaLoading.value = true;
  captchaError.value = "";
  try {
    const result = await authApi.captcha();
    captchaId.value = result.captcha_id;
    captchaSvg.value = result.image;
    form.code = "";
  } catch {
    captchaSvg.value = "";
    captchaError.value = "验证码加载失败，点击重试";
  } finally {
    captchaLoading.value = false;
  }
}

onMounted(() => {
  void loadCaptcha();
});

async function submit(): Promise<void> {
  errorMessage.value = "";
  const instance = formRef.value;
  if (!instance) return;

  const valid = await instance.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    await auth.login({
      username: form.username.trim(),
      password: form.password,
      code: form.code.trim(),
      captcha_id: captchaId.value,
    });
    ElMessage.success("登录成功");
    await router.replace(safeRedirect(route.query.redirect));
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : "登录失败，请稍后再试";
    void loadCaptcha();
  } finally {
    submitting.value = false;
  }
}

/** 只接受站内相对路径，避免 ?redirect=//evil.com 这类开放重定向 */
function safeRedirect(value: unknown): string {
  const target = Array.isArray(value) ? value[0] : value;
  if (typeof target !== "string") return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}
</script>

<template>
  <div class="login-page">
    <section class="login-brand">
      <div class="login-brand__top">
        <div class="app-brand__mark">A</div>
        <h1 class="login-brand__title">管理后台</h1>
      </div>

      <div>
        <p class="login-brand__slogan">
          菜单即路由，权限码即按钮。目录、页面、按钮和权限码都收在同一处维护，改完配置刷新即生效。
        </p>
        <ul class="login-brand__features">
          <li>
            <el-icon><Grid /></el-icon>
            <span>数据库驱动的动态菜单与动态路由</span>
          </li>
          <li>
            <el-icon><UserFilled /></el-icon>
            <span>直属子账号管理，权限可逐级转授</span>
          </li>
          <li>
            <el-icon><Key /></el-icon>
            <span>按钮级权限码校验，后端同步兜底</span>
          </li>
        </ul>
      </div>

      <div class="login-brand__foot">Fastify 5 · Vue 3 · Element Plus</div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <h2 class="login-card__title">登录</h2>
        <p class="login-card__desc">请使用管理员账号登录</p>

        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          type="error"
          :closable="false"
          show-icon
          style="margin-bottom: 18px"
        />

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="large" @submit.prevent="submit">
          <el-form-item label="账号" prop="username">
            <el-input
              v-model="form.username"
              :prefix-icon="User"
              placeholder="请输入管理员账号"
              autocomplete="username"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              :prefix-icon="Lock"
              type="password"
              show-password
              placeholder="请输入登录密码"
              autocomplete="current-password"
            />
          </el-form-item>

          <el-form-item label="验证码" prop="code">
            <div class="login-captcha">
              <el-input v-model="form.code" maxlength="3" placeholder="算式结果" />
              <div class="login-captcha__img" title="点击刷新验证码" @click="loadCaptcha">
                <span v-if="captchaLoading" class="muted" style="font-size: 12px">加载中</span>
                <span
                  v-else-if="captchaError"
                  class="muted"
                  style="padding: 0 8px; font-size: 12px; text-align: center"
                >
                  {{ captchaError }}
                </span>
                <div v-else v-html="captchaSvg"></div>
              </div>
            </div>
          </el-form-item>

          <el-button
            type="primary"
            size="large"
            native-type="submit"
            :loading="submitting"
            style="width: 100%; margin-top: 6px"
          >
            登录
          </el-button>
        </el-form>

        <p class="login-hint">初始账号 admin，初始密码由种子脚本的 ADMIN_SEED_PASSWORD 决定（未设置时为 123456）</p>
      </div>
    </section>
  </div>
</template>
