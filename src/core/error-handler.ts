import { AppError, BusinessCode } from "@/core/app-error";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    return reply.error(`接口不存在: ${request.method} ${request.url}`, BusinessCode.NOT_FOUND);
  });

  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.error(formatValidationErrorMessage(error.validation), BusinessCode.PARAM_ERROR);
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ error, cause: error.cause }, "响应数据不符合接口文档定义");
      return reply.error(error.message, BusinessCode.RESPONSE_FORMAT_ERROR);
    }

    if (error instanceof AppError) {
      return reply.error(error.message, error.code);
    }

    request.log.error({ error }, "请求处理异常");
    return reply.error("服务器内部错误", BusinessCode.INTERNAL_ERROR);
  });
}

function formatValidationErrorMessage(validation: Array<{ instancePath?: string; message?: string }>) {
  const details = validation
    .map((item) => {
      const path = item.instancePath || "/";
      const message = item.message || "参数格式不正确";
      return `${path} ${message}`;
    })
    .join("; ");

  return details ? `请求参数错误: ${details}` : "请求参数错误";
}
