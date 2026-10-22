export default class AiService {
  constructor(private readonly fastify: FastifyInstance) {}

  async detail() {
    return {
      name: "ai",
    };
  }
}
