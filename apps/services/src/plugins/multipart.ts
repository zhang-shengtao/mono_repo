import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import { env } from "@/core/env";
import { addFileMeta } from "@/core/request-log";

async function multipartPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: env.UPLOAD_MAX_FILE_SIZE,
      files: 1,
    },
    attachFieldsToBody: true,
    async onFile(part) {
      let bytes = 0;
      for await (const chunk of part.file) bytes += (chunk as Buffer).length;
      addFileMeta(this as unknown as FastifyRequest, {
        fieldname: part.fieldname,
        filename: part.filename,
        mimetype: part.mimetype,
        encoding: part.encoding,
        bytes,
      });
    },
  });
}

export default fp(multipartPlugin, {
  name: "multipart",
});
