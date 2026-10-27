import { AppError } from "@/core/app_error";
import { writeRequestLog } from "@/core/request_log";
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
    writeRequestLog(request);
    request.log.warn({ method: request.method, url: request.url }, "接口不存在");
    return reply.error(`接口不存在: ${request.method} ${request.url}`, BusinessCode.NOT_FOUND);
  });

  app.setErrorHandler((error, request, reply) => {
    writeRequestLog(request, { bodyError: readErrorCode(error) });

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
      if (error.code >= 500) request.log.error({ err: error }, "业务处理异常");
      else request.log.warn({ code: error.code, method: request.method, url: request.url, message: error.message }, "业务请求被拒绝");
      return reply.error(error.message, error.code);
    }

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

/** 请求日志兜底用的错误标识：优先取框架错误码（如 FST_REQ_FILE_TOO_LARGE） */
function readErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return error instanceof Error ? error.message : "unknown";
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
