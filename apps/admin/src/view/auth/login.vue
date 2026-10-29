<script setup lang="ts">
  import { getStorage, removeStorage, setStorage } from "@/utils/storage";

  defineOptions({ name: "Login" });

  const REMEMBER_KEY = "admin:login:account";

  const router = useRouter();

  const remembered = getStorage<string>(REMEMBER_KEY, "");

  const form = reactive({
    account: remembered,
    password: "",
    remember: remembered !== "",
  });

  const showPassword = ref(false);
  const loading = ref(false);
  const error = ref("");

  interface PasswordCredentialCtor {
    new (data: { id: string; password: string; name?: string }): Credential;
  }

  async function saveToBrowser() {
    const ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential;
    if (!ctor || typeof navigator.credentials?.store !== "function") return;

    try {
      await navigator.credentials.store(new ctor({ id: form.account, password: form.password, name: form.account }));
    } catch {
      return;
    }
  }

  async function submit() {
    if (loading.value) return;

    error.value = "";
    if (!form.account) {
      error.value = "请输入账号";
      return;
    }
    if (!form.password) {
      error.value = "请输入密码";
      return;
    }

    loading.value = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (form.remember) {
        setStorage(REMEMBER_KEY, form.account);
        await saveToBrowser();
      } else {
        removeStorage(REMEMBER_KEY);
      }

      ElMessage.success("登录成功");
      await router.replace("/dashboard");
    } finally {
      loading.value = false;
    }
  }

  function onForgot() {
    ElMessage.info("请联系系统管理员重置密码");
  }

  function toggleRemember() {
    form.remember = !form.remember;
    if (form.remember) return;

    removeStorage(REMEMBER_KEY);
    ElMessage.info("已清除本地账号缓存；浏览器已保存的密码需到浏览器的密码管理器中删除");
  }
</script>

<template>
  <div class="login">
    <div class="login-bg" aria-hidden="true">
      <span class="blob blob-a"></span>
      <span class="blob blob-b"></span>
      <span class="blob blob-c"></span>
      <span class="grid"></span>
    </div>

    <div class="login-card">
      <aside class="brand">
        <div class="brand-top">
          <div class="brand-mark">M</div>
          <div class="brand-title">
            <h1>Mono Admin</h1>
            <p>管理后台 · v0.1.0</p>
          </div>
        </div>

        <ul class="brand-list">
          <li>
            <MyIcon name="Lock" :size="15" />
            <span>统一鉴权与权限控制</span>
          </li>
          <li>
            <MyIcon name="Grid" :size="15" />
            <span>三种布局随时切换</span>
          </li>
          <li>
            <MyIcon name="MagicStick" :size="15" />
            <span>玻璃质感与主题联动</span>
          </li>
        </ul>

        <p class="brand-foot">© 2025 Mono Admin</p>
      </aside>

      <form class="form" method="post" @submit.prevent="submit">
        <header class="form-head">
          <h2>欢迎回来</h2>
          <p>登录以继续使用管理后台</p>
        </header>

        <div class="field">
          <label class="label" for="login-account">账号</label>
          <div class="control" :class="{ 'is-error': error === '请输入账号' }">
            <MyIcon name="User" :size="16" />
            <input
              id="login-account"
              v-model.trim="form.account"
              class="input"
              type="text"
              name="username"
              placeholder="请输入账号"
              autocomplete="username"
              autocapitalize="off"
              spellcheck="false"
            />
          </div>
        </div>

        <div class="field">
          <label class="label" for="login-password">密码</label>
          <div class="control" :class="{ 'is-error': error === '请输入密码' }">
            <MyIcon name="Lock" :size="16" />
            <input
              id="login-password"
              v-model="form.password"
              class="input"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="peek"
              :title="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <MyIcon :name="showPassword ? 'View' : 'Hide'" :size="15" />
            </button>
          </div>
        </div>

        <div class="row">
          <button
            type="button"
            class="remember"
            :class="{ 'is-on': form.remember }"
            title="勾选后由浏览器提示保存账号密码"
            @click="toggleRemember"
          >
            <span class="tick">
              <MyIcon v-if="form.remember" name="Check" :size="10" />
            </span>
            <span>记住账号</span>
          </button>

          <a class="link" href="javascript:void(0)" @click="onForgot">忘记密码？</a>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="submit" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? "登录中…" : "登 录" }}</span>
        </button>

        <p class="hint">演示环境：任意账号密码均可登录</p>
      </form>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .login {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 24px;
    overflow: hidden;
    background-color: var(--app-bg);
  }

  .login-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    will-change: transform;
  }

  .blob-a {
    top: -18vw;
    left: -12vw;
    width: 46vw;
    height: 46vw;
    background: color-mix(in srgb, var(--app-primary) 55%, transparent);
    opacity: 0.55;
    animation: drift-a 18s var(--app-ease) infinite alternate;
  }

  .blob-b {
    right: -16vw;
    bottom: -22vw;
    width: 52vw;
    height: 52vw;
    background: color-mix(in srgb, var(--app-primary) 28%, #22d3ee);
    opacity: 0.28;
    animation: drift-b 22s var(--app-ease) infinite alternate;
  }

  .blob-c {
    top: 32%;
    left: 46%;
    width: 22vw;
    height: 22vw;
    background: color-mix(in srgb, var(--app-primary) 24%, #f472b6);
    opacity: 0.2;
    animation: drift-a 26s var(--app-ease) infinite alternate-reverse;
  }

  @keyframes drift-a {
    from {
      transform: translate3d(0, 0, 0) scale(1);
    }
    to {
      transform: translate3d(5vw, 4vw, 0) scale(1.12);
    }
  }

  @keyframes drift-b {
    from {
      transform: translate3d(0, 0, 0) scale(1.06);
    }
    to {
      transform: translate3d(-5vw, -4vw, 0) scale(1);
    }
  }

  .grid {
    position: absolute;
    inset: 0;
    opacity: 0.5;
    background-image:
      linear-gradient(to right, color-mix(in srgb, var(--app-text-3) 14%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in srgb, var(--app-text-3) 14%, transparent) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(circle at 50% 42%, #000 0, transparent 72%);
    -webkit-mask-image: radial-gradient(circle at 50% 42%, #000 0, transparent 72%);
  }

  .login-card {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 320px 1fr;
    width: min(860px, 100%);
    overflow: hidden;
    border: 1px solid var(--app-glass-border);
    border-radius: 22px;
    background: var(--app-surface);
    backdrop-filter: var(--app-blur);
    -webkit-backdrop-filter: var(--app-blur);
    box-shadow:
      0 40px 90px color-mix(in srgb, #312e81 26%, transparent),
      var(--app-shadow-inset);
    animation: card-in 560ms var(--app-ease) both;
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: perspective(1200px) translateY(18px) rotateX(6deg) scale(0.985);
    }
  }

  .brand {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 32px 28px;
    overflow: hidden;
    color: #fff;
    background-image: linear-gradient(158deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 55%, #8b5cf6) 56%, color-mix(in srgb, var(--app-primary) 42%, #22d3ee));

    &::after {
      content: "";
      position: absolute;
      right: -70px;
      bottom: -90px;
      width: 240px;
      height: 240px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.14);
      filter: blur(6px);
    }
  }

  .brand-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-mark {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.18);
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
    backdrop-filter: blur(4px);
  }

  .brand-title h1 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .brand-title p {
    margin: 3px 0 0;
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.75);
  }

  .brand-list {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: auto 0;
    padding: 26px 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.9);
    }

    :deep(.icon) {
      color: rgba(255, 255, 255, 0.85);
      cursor: default;
    }
  }

  .brand-foot {
    position: relative;
    z-index: 1;
    margin: 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 36px 40px 30px;
  }

  .form-head {
    margin-bottom: 6px;

    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--app-text);
    }

    p {
      margin: 7px 0 0;
      font-size: 12.5px;
      color: var(--app-text-3);
    }
  }

  .field {
    display: flex;
    flex-direction: column;
  }

  .label {
    margin-bottom: 7px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--app-text-2);
  }

  .control {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 12px;
    border: 1px solid color-mix(in srgb, var(--app-text-3) 20%, transparent);
    border-radius: 11px;
    background-color: color-mix(in srgb, var(--app-text-3) 4%, transparent);
    transition:
      border-color var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease);

    &:focus-within {
      border-color: var(--app-primary);
      background-color: var(--app-surface);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-primary) 16%, transparent);
    }

    &.is-error {
      border-color: color-mix(in srgb, var(--app-danger) 70%, transparent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-danger) 14%, transparent);
    }

    :deep(.icon) {
      flex-shrink: 0;
      color: var(--app-text-3);
      cursor: default;
    }
  }

  .input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 13.5px;
    color: var(--app-text);

    &::placeholder {
      color: var(--app-text-3);
    }
  }

  .peek {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--app-text-3);
    cursor: pointer;
    transition:
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease);

    &:hover {
      color: var(--app-primary);
      background-color: color-mix(in srgb, var(--app-primary) 12%, transparent);
    }
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }

  .remember {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    font-family: inherit;
    font-size: 12.5px;
    color: var(--app-text-2);
    cursor: pointer;
    transition: color var(--app-dur) var(--app-ease);

    .tick {
      display: grid;
      place-items: center;
      width: 15px;
      height: 15px;
      border: 1px solid color-mix(in srgb, var(--app-text-3) 34%, transparent);
      border-radius: 5px;
      color: #fff;
      transition:
        background-color var(--app-dur) var(--app-ease),
        border-color var(--app-dur) var(--app-ease);
    }

    &.is-on {
      color: var(--app-text);

      .tick {
        border-color: var(--app-primary);
        background-color: var(--app-primary);
      }
    }
  }

  .link {
    font-size: 12.5px;
    color: var(--app-primary);
    cursor: pointer;
    transition: opacity var(--app-dur) var(--app-ease);

    &:hover {
      opacity: 0.78;
      text-decoration: underline;
    }
  }

  .error {
    margin: 0;
    font-size: 12.5px;
    color: var(--app-danger);
  }

  .submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    margin-top: 4px;
    border: 0;
    border-radius: 12px;
    background-image: linear-gradient(120deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 52%, #8b5cf6));
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
    box-shadow: 0 14px 30px color-mix(in srgb, var(--app-primary) 32%, transparent);
    transition:
      transform var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease),
      filter var(--app-dur) var(--app-ease);

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 18px 36px color-mix(in srgb, var(--app-primary) 38%, transparent);
      filter: saturate(1.08);
    }

    &:active:not(:disabled) {
      transform: translateY(0) scale(0.995);
    }

    &:disabled {
      cursor: progress;
      opacity: 0.86;
    }
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .hint {
    margin: 2px 0 0;
    font-size: 11px;
    text-align: center;
    color: var(--app-text-3);
  }

  @media (max-width: 820px) {
    .login-card {
      grid-template-columns: 1fr;
    }

    .brand {
      flex-direction: row;
      align-items: center;
      padding: 16px 20px;
    }

    .brand-list,
    .brand-foot {
      display: none;
    }

    .brand-mark {
      width: 36px;
      height: 36px;
      border-radius: 11px;
      font-size: 15px;
    }

    .brand-title h1 {
      font-size: 15px;
    }

    .form {
      padding: 22px 20px 26px;
    }
  }
</style>
