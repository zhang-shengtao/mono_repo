import fp from "fastify-plugin";
import { env } from "@/core/env";

const ROUTER_LOG_TYPE = "router";
const MAX_INLINE_PAYLOAD_LENGTH = 10 * 1024;
const OMITTED_FILE_VALUE = "[file omitted]";
const OMITTED_BINARY_VALUE = "[binary omitted]";
const OMITTED_STREAM_VALUE = "[stream omitted]";
const OMITTED_LARGE_VALUE = "[large payload omitted]";

type SanitizedLogValue = unknown;

// 请求响应日志记录器
async function loggerPlugin(fastify: FastifyInstance) {
  fastify.addHook("preHandler", (req, reply, done) => {
    if (req.url.startsWith("/docs")) return done();
    fastify.log.info({
      logType: ROUTER_LOG_TYPE,
      stage: "request",
      method: req.method,
      url: req.url,
      uid: req.id,
      body: sanitizeLogValue(req.body, env.LOG_LARGE_REQUEST_PAYLOAD),
      query: sanitizeLogValue(req.query, true),
      params: sanitizeLogValue(req.params, true),
      headers: req.headers,
    });
    done();
  });
  fastify.addHook("onSend", (req, reply, payload, done) => {
    if (req.url.startsWith("/docs")) return done();
    fastify.log.info({
      logType: ROUTER_LOG_TYPE,
      stage: "response",
      method: req.method,
      url: req.url,
      uid: req.id,
      statusCode: reply.statusCode,
      headers: reply.getHeaders(),
      payload: shouldOmitResponsePayload(reply.getHeaders())
        ? OMITTED_FILE_VALUE
        : sanitizeLogValue(payload, env.LOG_LARGE_RESPONSE_PAYLOAD),
    });
    done();
  });
}

function sanitizeLogValue(value: unknown, allowLargePayload: boolean, seen = new WeakSet<object>()): SanitizedLogValue {
  if (value == null) return value;

  if (typeof value === "string") {
    return allowLargePayload || value.length <= MAX_INLINE_PAYLOAD_LENGTH ? value : OMITTED_LARGE_VALUE;
  }

  if (typeof value !== "object") return value;

  if (Buffer.isBuffer(value)) return OMITTED_BINARY_VALUE;
  if (isStreamLike(value)) return OMITTED_STREAM_VALUE;
  if (isFileLike(value)) return OMITTED_FILE_VALUE;

  if (seen.has(value)) return "[circular omitted]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, allowLargePayload, seen));
  }

  const result: Record<string, SanitizedLogValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isFileFieldKey(key)) {
      result[key] = OMITTED_FILE_VALUE;
      continue;
    }
    result[key] = sanitizeLogValue(item, allowLargePayload, seen);
  }
  return result;
}

function shouldOmitResponsePayload(headers: Record<string, unknown>) {
  const contentDisposition = getHeaderValue(headers["content-disposition"]);
  if (contentDisposition?.includes("attachment")) return true;

  const contentType = getHeaderValue(headers["content-type"]);
  return Boolean(contentType && !isTextResponseContentType(contentType));
}

function getHeaderValue(value: unknown) {
  if (Array.isArray(value)) return value.join(";").toLowerCase();
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return String(value).toLowerCase();
  return "";
}

function isTextResponseContentType(contentType: string) {
  return (
    contentType.includes("application/json") ||
    contentType.includes("application/problem+json") ||
    contentType.startsWith("text/") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/x-www-form-urlencoded")
  );
}

function isStreamLike(value: unknown) {
  return Boolean(value && typeof value === "object" && typeof (value as { pipe?: unknown }).pipe === "function");
}

function isFileLike(value: object) {
  const file = value as { filename?: unknown; file?: unknown; mimetype?: unknown };
  return (
    typeof file.filename === "string" &&
    (isStreamLike(value) || isStreamLike(file.file) || typeof file.mimetype === "string")
  );
}

function isFileFieldKey(key: string) {
  return ["file", "files", "buffer", "stream"].includes(key.toLowerCase());
}

export default fp(loggerPlugin, {
  name: "logger",
});
