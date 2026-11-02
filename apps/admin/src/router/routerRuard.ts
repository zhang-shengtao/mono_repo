import { userPinia } from "@/pinia";
import { UNAUTHORIZED_EVENT } from "@/utils/request";
import type { Router } from "vue-router";

/** 免登录可访问的页面 */
const whiteList = ["/login", "/404", "/403"];

/** 只接受站内地址，避免 ?redirect=//evil.com 这类跳转 */
function safeRedirect(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "";
  return value === "/" ? "" : value;
}

/** 未登录 / 登录失效时统一去登录页，并记住原本要去的地址 */
function toLogin(to: string) {
  const redirect = safeRedirect(to);
  return { name: "login", query: redirect ? { redirect } : {} };
}

const title = useTitle("后台管理系统");

export default function (router: Router) {
  router.beforeEach(async (to) => {
    if (to.meta?.title) title.value = String(to.meta.title);

    const userStore = userPinia();

    // 1. 未登录：白名单放行，其余全部去登录
    if (!userStore.isLogged) {
      return whiteList.includes(to.path) ? true : toLogin(to.fullPath);
    }

    // 2. 已登录还进登录页：直接回首页
    if (to.name === "login") return { path: "/" };

    // 3. 首次进入或刷新后，补拉一次当前管理员资料；失败说明令牌已失效
    if (!userStore.profile) {
      try {
        await userStore.loadProfile();
      } catch {
        userStore.reset();
        return toLogin(to.fullPath);
      }
    }

    return true;
  });

  // 任意接口返回 401：清登录态回登录页（请求层不直接碰路由，靠事件解耦）
  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    const current = router.currentRoute.value;
    userPinia().reset();
    if (current.name === "login") return;

    void router.replace(toLogin(current.fullPath)).catch(() => {});
  });

  return router;
}
