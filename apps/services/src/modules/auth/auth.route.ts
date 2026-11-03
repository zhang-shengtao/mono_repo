import { captchaRouteOptions, loginRouteOptions, logoutRouteOptions, profileRouteOptions, routesRouteOptions } from "./auth.schema";
import AuthService from "./auth.service";
import MenuService from "../menu/menu.service";

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify);
  // 菜单数据归 menu 模块管，接口挂在 auth 下是因为它按「当前登录人」算，和 /auth/profile 是一对
  const menuService = new MenuService(fastify);

  fastify.get("/admin/auth/captcha", { ...captchaRouteOptions }, async function (request, reply) {
    return reply.success(await authService.issueCaptcha());
  });

  fastify.post("/admin/auth/login", { ...loginRouteOptions }, async function (request, reply) {
    return reply.success(await authService.login(request.body));
  });

  fastify.get("/admin/auth/profile", { ...profileRouteOptions }, async function (request, reply) {
    return reply.success(authService.getProfile(request.user!));
  });

  // 当前登录人可见的菜单：动态路由与按钮权限都从这里来
  fastify.get("/admin/auth/routes", { ...routesRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.routesFor(request.user!));
  });

  fastify.post("/admin/auth/logout", { ...logoutRouteOptions }, async function (request, reply) {
    await authService.logout(request.uid, request.user!.user_id);
    return reply.success({});
  });
}
