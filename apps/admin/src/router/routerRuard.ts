import { userPinia } from "@/pinia";
import type { Router } from "vue-router";

const whiteList = ["/login", "/404", "/403"]; // 路由白名单

const title = useTitle("后台管理系统");

export default function (router: Router) {
  router.beforeEach(async (to, from, next) => {
    const { userInfo } = userPinia();
    if (to.meta && to.meta.title) title.value = to.meta.title;
    next();
  });
  return router;
}
