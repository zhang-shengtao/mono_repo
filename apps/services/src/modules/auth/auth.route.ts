import { captchaRouteOptions, loginRouteOptions, logoutRouteOptions, profileRouteOptions, routesRouteOptions } from "./auth.schema";
import AuthService from "./auth.service";
import MenuService from "../menu/menu.service";

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify);

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

  fastify.get("/admin/auth/routes", { ...routesRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.routesFor(request.user!));
  });

  fastify.post("/admin/auth/logout", { ...logoutRouteOptions }, async function (request, reply) {
    await authService.logout(request.uid, request.user!.user_id);
    return reply.success({});
  });
}
