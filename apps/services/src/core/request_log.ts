/**
 * 请求日志的数据准备（纯逻辑，不含钩子注册，避免 core 反向依赖 plugins）。
 *
 * 三段式：
 * 1) onRequest      —— 只把请求元信息挂到 WeakMap，**不写日志**；
 *                      这样即使 multipart 解析失败（文件超限）信息也不会丢；
 * 2) preValidation  —— 补 body / files，写出唯一一条请求日志
 *                      （由 autoload 的 dependencies 保证排在 multipart 之后）；
 * 3) error_handler  —— 解析失败时调 writeRequestLog 兜底（幂等）。
 */
import type { FastifyRequest } from "fastify";
import { resolveSanitizeLimits, sanitize } from "@repo/logger";

/** 文档与健康检查不记（与原实现一致） */
const SKIP_URL_PREFIXES = ["/docs", "/api/health"];
const LOG_TYPE = "router";

/** 与 @repo/logger 的 loadLogConfig 同源：同一组 LOG_BODY_* 配置 */
const SANITIZE_LIMITS = resolveSanitizeLimits(process.env);

export interface FileMeta {
  fieldname: string;
  filename?: string;
  mimetype?: string;
  encoding?: string;
  bytes: number;
}

const requestCache = new WeakMap<FastifyRequest, Record<string, unknown>>();
const filesByRequest = new WeakMap<FastifyRequest, FileMeta[]>();
const loggedRequests = new WeakSet<FastifyRequest>();

export function shouldSkipRequest(url: string): boolean {
  return SKIP_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/** multipart 的 onFile 里调用（内容已被流式丢弃，只留元信息） */
export function addFileMeta(request: FastifyRequest, meta: FileMeta): void {
  const list = filesByRequest.get(request);
  if (list) list.push(meta);
  else filesByRequest.set(request, [meta]);
}

/** onRequest 阶段调用：只缓存，不产生任何输出 */
export function cacheRequestMeta(request: FastifyRequest): void {
  const headers = request.headers;
  requestCache.set(request, {
    method: request.method,
    url: request.url,
    requestId: request.id,
    ip: request.ip,
    contentType: headers["content-type"],
    contentLength: headers["content-length"],
    headers,
    query: request.query,
    params: request.params,
  });
}

/**
 * multipart + attachFieldsToBody 时 body 形如：
 *   { name: { type:'field', fieldname:'name', value:'报表' },
 *     file: { type:'file', fieldname:'file', filename:'a.xlsx', ... } }
 *
 * 注意：即使配了 onFile，**文件条目仍然会留在 request.body 里**（实测）。
 * 这里必须跳过它们——文件只出现在 `files` 字段，body 里不能有。
 */
function extractMultipartFields(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null) return undefined;

  const fields: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(body as Record<string, unknown>)) {
    const part = entry as { type?: unknown; value?: unknown };
    if (part && part.type === "file") continue;
    fields[key] = part && part.type === "field" ? part.value : entry;
  }
  return fields;
}

/** 写请求日志（幂等：同一次请求最多一条） */
export function writeRequestLog(request: FastifyRequest, extra?: Record<string, unknown>): void {
  if (loggedRequests.has(request)) return;
  loggedRequests.add(request);

  const cached = requestCache.get(request);
  if (!cached) return;

  const record: Record<string, unknown> = { logType: LOG_TYPE, stage: "request", ...cached, ...extra };

  const rawBody = request.isMultipart() ? extractMultipartFields(request.body) : request.body;
  if (rawBody !== undefined && rawBody !== null) {
    const { value, truncated } = sanitize(rawBody, SANITIZE_LIMITS);
    record.body = value;
    if (truncated) record.bodyTruncated = true;
  }

  const files = filesByRequest.get(request);
  if (files && files.length > 0) record.files = files;

  request.log.info(record);
}
