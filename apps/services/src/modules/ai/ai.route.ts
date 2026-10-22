import { aiDetailRouteOptions } from "./ai.schema";
import AiService from "./ai.service";

export default async function aiRoutes(fastify: FastifyInstance) {
  const aiService = new AiService(fastify);

  fastify.get("/api/ai/detail", { ...aiDetailRouteOptions }, async function (request, reply) {
    const result = await aiService.detail();
    return reply.success(result);
  });
}
