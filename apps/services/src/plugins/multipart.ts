import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import { env } from "@/core/env";

async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: env.UPLOAD_MAX_FILE_SIZE,
      files: 1,
    },
  });
}

export default fp(multipartPlugin, {
  name: "multipart",
});
