import {
  menuAddRouteOptions,
  menuCurrentUserRouteOptions,
  menuDeleteRouteOptions,
  menuListRouteOptions,
  menuUpdateRouteOptions,
} from "./menu.schema";
import MenuService from "./menu.service";

export default async function menuRoutes(fastify: FastifyInstance) {
  const menuService = new MenuService(fastify);

  fastify.post("/admin/menu/list", { ...menuAddRouteOptions }, async function (request, reply) {
    const { children, ...menuData } = request.body;
    const result = await menuService.add(menuData, children);
    return reply.success(result);
  });

  fastify.put("/admin/menu/list", { ...menuUpdateRouteOptions }, async function (request, reply) {
    await menuService.update(request.body);
    return reply.success({});
  });

  fastify.get("/admin/menu/list", { ...menuListRouteOptions }, async function (request, reply) {
    const result = await menuService.list(request.query.search);
    return reply.success(result);
  });

  fastify.get("/admin/user/menus", { ...menuCurrentUserRouteOptions }, async function (request, reply) {
    const result = await menuService.getCurrentUserMenus(request.user.uid);
    return reply.success(result);
  });

  fastify.delete("/admin/menu/list/:admin_menus_id", { ...menuDeleteRouteOptions }, async function (request, reply) {
    const menuId = request.params.admin_menus_id;
    await menuService.delete(menuId);
    return reply.success({});
  });
}
