<script setup lang="ts">
  /**
   * 403 无访问权限
   *
   * 路由里与 /login 同级、不在布局壳内，所以页面自己铺满一屏。
   * 被拦截的地址优先取 ?from= / ?redirect=（守卫或网关跳转时带上），
   * 没有就回落到当前 fullPath，方便用户把地址原样反馈给管理员。
   */
  defineOptions({ name: "Forbidden" });

  const route = useRoute();
  const router = useRouter();

  const blockedPath = computed(() => {
    const from = route.query.from ?? route.query.redirect;
    return typeof from === "string" && from.trim() !== "" ? from.trim() : route.fullPath;
  });

  function goHome() {
    router.replace("/dashboard");
  }

  function goBack() {
    // 直接打开 /403（刷新、外链）时没有可回退的历史，回落到首页，避免把用户弹出应用
    const state = window.history.state as { back?: string | null } | null;
    if (state?.back) {
      router.back();
      return;
    }
    goHome();
  }

  function relogin() {
    router.replace("/login");
  }
</script>

<template>
  <div class="error-page">
    <div class="backdrop" aria-hidden="true">
      <span class="blob blob-a"></span>
      <span class="blob blob-b"></span>
      <span class="grid"></span>
    </div>

    <header class="topbar">
      <button type="button" class="brand" title="回到首页" @click="goHome">
        <span class="brand-mark">M</span>
        <span class="brand-name">Mono Admin</span>
      </button>

      <span class="badge">HTTP 403</span>
    </header>

    <main class="panel">
      <div class="art" aria-hidden="true">
        <svg viewBox="0 0 200 200" role="presentation">
          <defs>
            <linearGradient id="err403-shield" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" class="stop-a" />
              <stop offset="100%" class="stop-b" />
            </linearGradient>
          </defs>

          <circle class="orbit" cx="100" cy="100" r="86" />
          <path class="shield" d="M100 30L150 50v48c0 33-22 56-50 70c-28-14-50-37-50-70V50Z" />
          <rect class="lock" x="86" y="94" width="28" height="27" rx="6" />
          <path class="lock-arch" d="M92 94V86a8 8 0 0 1 16 0v8" />
          <circle class="keyhole" cx="100" cy="103" r="3.2" />
          <path class="keyhole-stem" d="M100 106v5" />
          <circle class="spark" cx="100" cy="8" r="2.6" />
          <circle class="spark" cx="180" cy="150" r="2" />
        </svg>
      </div>

      <div class="content">
        <p class="code" aria-hidden="true">403</p>
        <h1>抱歉，你没有访问该页面的权限</h1>
        <p class="desc">当前账号的角色没有获得此资源的访问许可。如需继续，请联系系统管理员为你分配相应权限，或切换为有权限的账号后重试。</p>

        <p class="path" title="被拦截的访问地址">
          <MyIcon name="Link" :size="13" />
          <span class="path-text">{{ blockedPath }}</span>
        </p>

        <div class="actions">
          <button type="button" class="btn btn-primary" @click="goHome">
            <MyIcon name="HomeFilled" :size="15" />
            返回首页
          </button>
          <button type="button" class="btn btn-ghost" @click="goBack">
            <MyIcon name="Back" :size="15" />
            返回上一页
          </button>
          <button type="button" class="btn btn-text" @click="relogin">切换账号登录</button>
        </div>

        <p class="hint">若确认权限无误，请把上方地址连同错误码 403 一起反馈给管理员。</p>
      </div>
    </main>

    <footer class="foot">Mono Admin · 管理后台</footer>
  </div>
</template>

<style lang="scss" scoped>
  .error-page {
    /* 403 用危险色系，和 404 的品牌色区分开 */
    --code-1: color-mix(in srgb, var(--app-danger) 82%, var(--app-primary));
    --code-2: var(--app-danger);
    --code-3: color-mix(in srgb, var(--app-warning) 72%, var(--app-danger));

    position: relative;
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 20px 24px 16px;
    color: var(--app-text);
    background-color: var(--app-bg);
  }

  .backdrop {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(72px);
    will-change: transform;
  }

  .blob-a {
    top: -20vw;
    left: -14vw;
    width: 46vw;
    height: 46vw;
    background: color-mix(in srgb, var(--code-1) 52%, transparent);
    opacity: 0.42;
    animation: drift-a 20s var(--app-ease) infinite alternate;
  }

  .blob-b {
    right: -16vw;
    bottom: -20vw;
    width: 50vw;
    height: 50vw;
    background: color-mix(in srgb, var(--code-3) 30%, #22d3ee);
    opacity: 0.2;
    animation: drift-b 24s var(--app-ease) infinite alternate;
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
    opacity: 0.45;
    background-image:
      linear-gradient(to right, color-mix(in srgb, var(--app-text-3) 14%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in srgb, var(--app-text-3) 14%, transparent) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(circle at 50% 40%, #000 0, transparent 70%);
    -webkit-mask-image: radial-gradient(circle at 50% 40%, #000 0, transparent 70%);
  }

  .topbar {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: min(900px, 100%);
    margin: 0 auto;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--app-text);
    font-family: inherit;
    cursor: pointer;
    transition: opacity var(--app-dur) var(--app-ease);

    &:hover {
      opacity: 0.78;
    }
  }

  .brand-mark {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background-image: linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 55%, #8b5cf6) 55%, color-mix(in srgb, var(--app-primary) 42%, #22d3ee));
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 6px 16px color-mix(in srgb, var(--app-primary) 30%, transparent);
  }

  .brand-name {
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .badge {
    flex-shrink: 0;
    padding: 4px 10px;
    border: 1px solid color-mix(in srgb, var(--code-2) 30%, transparent);
    border-radius: var(--app-radius-pill);
    background-color: color-mix(in srgb, var(--code-2) 10%, transparent);
    color: var(--code-2);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .panel {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    align-items: center;
    gap: 36px;
    width: min(900px, 100%);
    margin: auto;
    padding: 34px 38px;
    border: 1px solid var(--app-glass-border);
    border-radius: 24px;
    background: var(--app-surface);
    backdrop-filter: var(--app-blur);
    -webkit-backdrop-filter: var(--app-blur);
    box-shadow:
      0 40px 90px color-mix(in srgb, #312e81 22%, transparent),
      var(--app-shadow-inset);
    animation: panel-in 560ms var(--app-ease) both;
  }

  @keyframes panel-in {
    from {
      opacity: 0;
      transform: perspective(1200px) translateY(16px) rotateX(5deg) scale(0.985);
    }
  }

  .art {
    position: relative;
    display: grid;
    place-items: center;

    &::before {
      content: "";
      position: absolute;
      inset: 6%;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--code-1) 26%, transparent), transparent 68%);
      filter: blur(10px);
    }

    svg {
      position: relative;
      width: min(236px, 100%);
      height: auto;
      overflow: visible;
    }
  }

  .orbit {
    fill: none;
    stroke: var(--code-1);
    stroke-width: 1.6;
    stroke-dasharray: 2 8;
    stroke-linecap: round;
    opacity: 0.42;
  }

  .shield {
    fill: url(#err403-shield);
    stroke: var(--code-1);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }

  .stop-a {
    stop-color: var(--code-1);
    stop-opacity: 0.3;
  }

  .stop-b {
    stop-color: var(--code-2);
    stop-opacity: 0.06;
  }

  .lock {
    fill: var(--app-solid);
    stroke: var(--code-1);
    stroke-width: 2.2;
  }

  .lock-arch {
    fill: none;
    stroke: var(--code-1);
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  .keyhole,
  .spark {
    fill: var(--code-1);
  }

  .keyhole-stem {
    stroke: var(--code-1);
    stroke-width: 2.2;
    stroke-linecap: round;
  }

  .spark {
    opacity: 0.55;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .code {
    margin: 0;
    font-size: clamp(54px, 9vw, 84px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.05em;
    background-image: linear-gradient(120deg, var(--code-1), var(--code-2) 58%, var(--code-3));
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    filter: drop-shadow(0 14px 28px color-mix(in srgb, var(--code-2) 24%, transparent));
  }

  h1 {
    margin: 0;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.4;
    color: var(--app-text);
  }

  .desc {
    margin: 0;
    max-width: 40ch;
    font-size: 13px;
    line-height: 1.78;
    color: var(--app-text-3);
  }

  .path {
    display: flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    margin: 2px 0 0;
    padding: 7px 11px;
    border: 1px dashed color-mix(in srgb, var(--app-text-3) 30%, transparent);
    border-radius: 10px;
    background-color: color-mix(in srgb, var(--app-text-3) 5%, transparent);
    font-size: 12px;
    color: var(--app-text-2);

    :deep(.icon) {
      flex-shrink: 0;
      color: var(--code-1);
      cursor: default;
    }
  }

  .path-text {
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 40px;
    padding: 0 16px;
    border-radius: 11px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      transform var(--app-dur) var(--app-ease),
      box-shadow var(--app-dur) var(--app-ease),
      border-color var(--app-dur) var(--app-ease),
      background-color var(--app-dur) var(--app-ease),
      color var(--app-dur) var(--app-ease);

    &:active {
      transform: translateY(1px) scale(0.995);
    }
  }

  .btn-primary {
    border: 0;
    color: #fff;
    font-weight: 600;
    background-image: linear-gradient(120deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 52%, #8b5cf6));
    box-shadow: 0 12px 26px color-mix(in srgb, var(--app-primary) 30%, transparent);

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 16px 32px color-mix(in srgb, var(--app-primary) 36%, transparent);
    }
  }

  .btn-ghost {
    border: 1px solid color-mix(in srgb, var(--app-text-3) 26%, transparent);
    background-color: transparent;
    color: var(--app-text-2);

    &:hover {
      border-color: color-mix(in srgb, var(--app-primary) 34%, transparent);
      background-color: color-mix(in srgb, var(--app-primary) 8%, transparent);
      color: var(--app-primary);
    }
  }

  .btn-text {
    height: 34px;
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: var(--app-text-3);
    font-size: 12.5px;

    &:hover {
      color: var(--app-primary);
    }
  }

  .hint {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.65;
    color: var(--app-text-3);
  }

  .foot {
    position: relative;
    z-index: 1;
    margin: 0;
    font-size: 11px;
    text-align: center;
    color: var(--app-text-3);
  }

  @media (max-width: 860px) {
    .error-page {
      gap: 14px;
      padding: 16px;
    }

    .panel {
      grid-template-columns: 1fr;
      gap: 20px;
      padding: 26px 22px;
    }

    .art svg {
      width: min(168px, 56vw);
    }

    .content {
      align-items: center;
      text-align: center;
    }

    .desc {
      max-width: 46ch;
    }

    .actions {
      justify-content: center;
    }
  }

  @media (max-width: 420px) {
    .brand-name {
      display: none;
    }

    .btn {
      height: 38px;
      padding: 0 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .blob,
    .panel {
      animation: none;
    }
  }
</style>
