import CodeService from "./code.service";
import { codeListRouteOptions, codeUpdateRouteOptions } from "./code.schema";

export default async function codeRoutes(fastify: FastifyInstance) {
  const codeService = new CodeService(fastify);

  fastify.get("/admin/code/list", { ...codeListRouteOptions }, async function (request, reply) {
    return reply.success(await codeService.list(request.query));
  });

  fastify.put("/admin/code/update", { ...codeUpdateRouteOptions }, async function (request, reply) {
    return reply.success(await codeService.update(request.body));
  });
}
