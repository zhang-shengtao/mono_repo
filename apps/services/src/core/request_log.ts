import type { FastifyRequest } from "fastify";
import { resolveSanitizeLimits, sanitize } from "@repo/logger";

const SKIP_URL_PREFIXES = ["/docs", "/api/health"];
const LOG_TYPE = "router";

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

export function addFileMeta(request: FastifyRequest, meta: FileMeta): void {
  const list = filesByRequest.get(request);
  if (list) list.push(meta);
  else filesByRequest.set(request, [meta]);
}

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
