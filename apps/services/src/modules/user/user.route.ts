import UserService from "./user.service";
import {
  userCreateRouteOptions,
  userDeleteRouteOptions,
  userListRouteOptions,
  userPermissionGetRouteOptions,
  userPermissionPutRouteOptions,
  userUpdateRouteOptions,
} from "./user.schema";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService(fastify);

  fastify.get("/admin/user/list", { ...userListRouteOptions }, async function (request, reply) {
    return reply.success(await userService.list(request.query, request.user!));
  });

  fastify.post("/admin/user/create", { ...userCreateRouteOptions }, async function (request, reply) {
    return reply.success(await userService.create(request.body, request.user!));
  });

  fastify.put("/admin/user/update", { ...userUpdateRouteOptions }, async function (request, reply) {
    return reply.success(await userService.update(request.body, request.user!));
  });

  fastify.delete("/admin/user/:user_id", { ...userDeleteRouteOptions }, async function (request, reply) {
    return reply.success(await userService.remove(request.params.user_id, request.user!));
  });

  // 权限：读一份「已分配 + 可分配」的快照，保存时按全量覆盖写 permissions
  fastify.get("/admin/user/:user_id/permission", { ...userPermissionGetRouteOptions }, async function (request, reply) {
    return reply.success(await userService.permissionDetail(request.params.user_id, request.user!));
  });

  fastify.put("/admin/user/permission", { ...userPermissionPutRouteOptions }, async function (request, reply) {
    return reply.success(await userService.savePermission(request.body, request.user!));
  });
}
