import { captchaRouteOptions, loginRouteOptions, logoutRouteOptions, profileRouteOptions } from "./auth.schema";
import AuthService from "./auth.service";

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify);

  fastify.get("/admin/auth/captcha", { ...captchaRouteOptions }, async function (request, reply) {
    return reply.success(await authService.issueCaptcha());
  });

  fastify.post("/admin/auth/login", { ...loginRouteOptions }, async function (request, reply) {
    return reply.success(await authService.login(request.body));
  });

  fastify.get("/admin/auth/profile", { ...profileRouteOptions }, async function (request, reply) {
    return reply.success(await authService.getProfile(request.user.uid));
  });

  fastify.post("/admin/auth/logout", { ...logoutRouteOptions }, async function (request, reply) {
    await authService.logout(request.user.uid);
    return reply.success({});
  });
}
