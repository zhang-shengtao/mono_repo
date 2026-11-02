import CodeService from "./code.service";
import { codeListRouteOptions } from "./code.schema";

export default async function codeRoutes(fastify: FastifyInstance) {
  const codeService = new CodeService(fastify);

  fastify.get("/admin/code/list", { ...codeListRouteOptions }, async function (request, reply) {
    return reply.success(await codeService.list(request.query));
  });
}
