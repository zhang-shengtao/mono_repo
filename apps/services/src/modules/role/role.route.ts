import RoleService from "./role.service";
import { roleCreateRouteOptions, roleDeleteRouteOptions, roleListRouteOptions, roleMenuScopeRouteOptions, roleUpdateRouteOptions } from "./role.schema";

export default async function roleRoutes(fastify: FastifyInstance) {
  const roleService = new RoleService(fastify);

  fastify.get("/admin/role/list", { ...roleListRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.list(request.query, request.user!));
  });

  // 角色表单的菜单候选范围：按当前登录人算，超管看全量、二级管理员只看自己可下放的
  fastify.get("/admin/role/menu-scope", { ...roleMenuScopeRouteOptions }, async function (request, reply) {
    return reply.success(await roleService.scope(request.user!));
  });

  // 写操作要落 created_by / updated_by，还要按登录人的层级校验下放范围：
  // request.user 是 jwt 插件查出来的整行用户数据，config.auth 已经保证它存在
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
