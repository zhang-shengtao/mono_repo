import { codeFilterRouteOptions, codeListRouteOptions, codeUpdateRouteOptions } from "./code.schema";
import CodeService from "./code.service";

export default async function codeRoutes(fastify: FastifyInstance) {
  const codeService = new CodeService(fastify);

  fastify.put("/admin/code/list", { ...codeUpdateRouteOptions }, async function (request, reply) {
    await codeService.updateStatus(request.body);
    return reply.success({});
  });

  fastify.get("/admin/code/list", { ...codeListRouteOptions }, async function (request, reply) {
    const result = await codeService.list(request.query);
    return reply.success(result);
  });

  fastify.get("/admin/code/filter", { ...codeFilterRouteOptions }, async function (request, reply) {
    const result = await codeService.filter(request.query);
    return reply.success(result);
  });
}
