import MenuService from "./menu.service";
import { menuCreateRouteOptions, menuDeleteRouteOptions, menuTreeRouteOptions, menuUpdateRouteOptions } from "./menu.schema";

export default async function menuRoutes(fastify: FastifyInstance) {
  const menuService = new MenuService(fastify);

  fastify.get("/admin/menu/tree", { ...menuTreeRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.tree(request.query));
  });

  fastify.post("/admin/menu/create", { ...menuCreateRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.create(request.body));
  });

  fastify.put("/admin/menu/update", { ...menuUpdateRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.update(request.body));
  });

  fastify.delete("/admin/menu/:menus_id", { ...menuDeleteRouteOptions }, async function (request, reply) {
    return reply.success(await menuService.remove(request.params.menus_id));
  });
}
