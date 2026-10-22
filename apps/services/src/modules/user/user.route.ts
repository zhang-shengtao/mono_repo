import { BusinessCode } from "@repo/shared";
import {
  userAddRouteOptions,
  userDeleteRouteOptions,
  userInfoRouteOptions,
  userListRouteOptions,
  userLoginRouteOptions,
  userLogoutRouteOptions,
  userPermissionGetRouteOptions,
  userPermissionPutRouteOptions,
  userUpdateRouteOptions,
} from "./user.schema";
import UserService from "./user.service";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify);

  fastify.get("/admin/user/list", { ...userListRouteOptions }, async function (request, reply) {
    const result = await userService.list(request.query, request.user.uid);
    return reply.success(result);
  });

  fastify.post("/admin/user/list", { ...userAddRouteOptions }, async function (request, reply) {
    const result = await userService.add(request.body, request.user.uid);
    return reply.success(result);
  });

  fastify.put("/admin/user/list", { ...userUpdateRouteOptions }, async function (request, reply) {
    await userService.update(request.body, request.user.uid);
    return reply.success({});
  });

  fastify.delete("/admin/user/list/:user_id", { ...userDeleteRouteOptions }, async function (request, reply) {
    await userService.delete(request.params.user_id, request.user.uid);
    return reply.success({});
  });

  fastify.get(
    "/admin/user/permissions/:user_id",
    { ...userPermissionGetRouteOptions },
    async function (request, reply) {
      const result = await userService.getPermissions(request.params.user_id, request.user.uid);
      return reply.success(result);
    },
  );

  fastify.put("/admin/user/permissions", { ...userPermissionPutRouteOptions }, async function (request, reply) {
    await userService.setPermissions(request.body, request.user.uid);
    return reply.success({});
  });

  fastify.get("/admin/user/info", { ...userInfoRouteOptions }, async function (request, reply) {
    const result = await userService.getInfo(request.user.uid);
    return reply.success(result);
  });

  fastify.post("/admin/user/logout", { ...userLogoutRouteOptions }, async function (request, reply) {
    await userService.logout(request.user.uid);
    return reply.success({});
  });

  fastify.post("/admin/user/login", { ...userLoginRouteOptions }, async function (request, reply) {
    const { username, password, code, captcha_id } = request.body;
    const captchaKey = `captcha_id:${captcha_id}`;
    const answer = await fastify.redis.get(captchaKey);
    if (answer) await fastify.redis.del(captchaKey);
    if (answer === null || answer.toLowerCase() !== code.toLowerCase()) {
      return reply.error("验证码过期或错误", BusinessCode.PARAM_ERROR);
    }
    const token = await userService.login(username, password);
    return reply.success({ token });
  });
}
