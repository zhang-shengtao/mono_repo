import fp from "fastify-plugin";
import { cacheRequestMeta, shouldSkipRequest, writeRequestLog } from "@/core/request-log";


async function requestLogPlugin(fastify: FastifyInstance) {
  fastify.addHook("onRequest", (request, _reply, done) => {
    if (shouldSkipRequest(request.url)) return done();
    cacheRequestMeta(request);
    done();
  });

  fastify.addHook("preValidation", (request, _reply, done) => {
    if (shouldSkipRequest(request.url)) return done();
    writeRequestLog(request);
    done();
  });
}

export default fp(requestLogPlugin, {
  name: "request-log",
  dependencies: ["multipart"],
});
