import RoleService from "./role.service";
import { roleCreateRouteOptions, roleDeleteRouteOptions, roleListRouteOptions, roleMenuScopeRouteOptions, roleUpdateRouteOptions } from "./role.schema";

export default async function roleRoutes(fastify: FastifyInstance) {
  const roleService = new RoleService(fastify);

  fastify.get("/admin/role/list", { ...roleListRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.list(request.query, request.user!));
  });

  fastify.get("/admin/role/menu-scope", { ...roleMenuScopeRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.scope(request.user!));
  });

  fastify.post("/admin/role/create", { ...roleCreateRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.create(request.body, request.user!));
  });

  fastify.put("/admin/role/update", { ...roleUpdateRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.update(request.body, request.user!));
  });

  fastify.delete("/admin/role/:roles_id", { ...roleDeleteRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.remove(request.params.roles_id, request.user!));
  });
}
