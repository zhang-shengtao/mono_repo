import { BusinessCode } from "@/core/app-error";

export function registerResponse(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.decorateReply("success", function success<
    T,
  >(this: FastifyReply, data: T, message = "success", code = BusinessCode.SUCCESS) {
    return this.send({ code, message, data, request_id: this.request.id });
  });

  app.decorateReply(
    "error",
    function error(this: FastifyReply, message = "error", code = BusinessCode.RESPONSE_FORMAT_ERROR) {
      const statusCode = code >= 400 && code <= 599 ? code : BusinessCode.INTERNAL_ERROR;
      return this.code(statusCode).send({ code, message, data: null, request_id: this.request.id });
    },
  );
}
