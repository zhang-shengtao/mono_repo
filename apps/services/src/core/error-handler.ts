import { AppError } from "@/core/app-error";
import { BusinessCode } from "@repo/shared";
import type { ZodFastifySchemaValidationError } from "fastify-type-provider-zod";
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from "fastify-type-provider-zod";

/** 框架/底层抛出的 HTTP 状态码 → 业务码 */
const STATUS_CODE_BUSINESS_CODE: Record<number, BusinessCode> = {
  400: BusinessCode.PARAM_ERROR,
  401: BusinessCode.UNAUTHORIZED,
  403: BusinessCode.FORBIDDEN,
  404: BusinessCode.NOT_FOUND,
  405: BusinessCode.METHOD_NOT_ALLOWED,
  409: BusinessCode.CONFLICT,
  413: BusinessCode.PAYLOAD_TOO_LARGE,
  415: BusinessCode.UNSUPPORTED_MEDIA_TYPE,
  429: BusinessCode.TOO_MANY_REQUESTS,
  500: BusinessCode.INTERNAL_ERROR,
  502: BusinessCode.BAD_GATEWAY,
  503: BusinessCode.SERVICE_UNAVAILABLE,
};

const DEFAULT_SERVER_ERROR_MESSAGE = "服务器内部错误";

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    // 响应侧已不再统一记日志，这里补一条，否则 404 在日志里只剩「请求进来过」
    request.log.warn({ method: request.method, url: request.url }, "接口不存在");
    return reply.error(`接口不存在: ${request.method} ${request.url}`, BusinessCode.NOT_FOUND);
  });

  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = formatValidationErrorMessage(error.validation);
      request.log.warn({ method: request.method, url: request.url, message }, "请求参数校验失败");
      return reply.error(message, BusinessCode.PARAM_ERROR);
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, cause: error.cause }, "响应数据不符合接口文档定义");
      return reply.error("响应数据格式校验失败", BusinessCode.RESPONSE_FORMAT_ERROR);
    }

    if (error instanceof AppError) {
      // 响应侧日志移除后，这里是 4xx 唯一的记录点（鉴权失败、资源不存在、状态冲突都抛 AppError）。
      // 4xx 属于「请求被拒」而不是「服务出错」，和下面框架层错误统一用 warn。
      if (error.code >= 500) request.log.error({ err: error }, "业务处理异常");
      else
        request.log.warn(
          { code: error.code, method: request.method, url: request.url, message: error.message },
          "业务请求被拒绝",
        );
      return reply.error(error.message, error.code);
    }

    // 框架层错误（body 超限 413、Content-Type 不支持 415、JSON 不合法 400 等）
    // 必须保留原始 HTTP 语义，不能一律兜成 500
    const statusCode = readHttpStatusCode(error);
    const businessCode = STATUS_CODE_BUSINESS_CODE[statusCode];

    if (!businessCode) {
      request.log.error({ err: error, statusCode }, "未映射的 HTTP 状态码，按服务器错误处理");
      return reply.error(DEFAULT_SERVER_ERROR_MESSAGE, BusinessCode.INTERNAL_ERROR);
    }

    if (statusCode >= 500) {
      request.log.error({ err: error, statusCode }, "请求处理异常");
      return reply.error(DEFAULT_SERVER_ERROR_MESSAGE, businessCode);
    }

    request.log.warn({ err: error, statusCode }, "请求被拒绝");
    return reply.error(readErrorMessage(error, "请求处理失败"), businessCode);
  });
}

function readHttpStatusCode(error: unknown) {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number" && statusCode >= 400) return statusCode;
  }
  return 500;
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatValidationErrorMessage(validation: ZodFastifySchemaValidationError[]) {
  const details = validation
    .map((item) => {
      const path = item.instancePath || "/";
      const message = item.message || "参数格式不正确";
      return `${path} ${message}`;
    })
    .join("; ");

  return details ? `请求参数错误: ${details}` : "请求参数错误";
}
