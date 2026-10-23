/**
 * 序列化前的净化：把"不能 / 不该"进日志的值换成描述符。
 *
 * 铁律：
 * 1) Buffer / 流绝不进管道 —— JSON.stringify(Buffer) 膨胀 4 倍：
 *    10MB 文件 ≈ 40MB 字符串 + 约 110ms 同步阻塞（实测 1MB = 11.1ms / 4.2MB）；
 * 2) 成本只与节点数有关，与单值大小无关（大字符串只读 .length）；
 * 3) 永不抛异常 —— 环形引用 / Proxy / getter 抛错都退化成描述符。
 */
import { isRecord } from "./object.js";

export interface SanitizeOptions {
  /** 字符串超过这个长度换成摘要（用 .length 近似字节，不额外扫内容） */
  maxStringBytes?: number;
  /** 遍历节点上限，超过就整体摘要 */
  maxNodes?: number;
  /** 递归深度上限 */
  maxDepth?: number;
}

export interface SanitizeResult {
  value: unknown;
  /** 有任意值被替换成摘要 */
  truncated: boolean;
  nodes: number;
}

const DEFAULT_MAX_STRING = 16 * 1024;
const DEFAULT_MAX_NODES = 2000;
const DEFAULT_MAX_DEPTH = 6;
const DATA_URI_PREFIX = "data:";
const INLINE_BASE64_MIN = 1024;

function isBufferLike(value: object): boolean {
  return value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function isStreamLike(value: object): boolean {
  return typeof (value as { pipe?: unknown }).pipe === "function";
}

function isBlobLike(value: object): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

export function sanitize(input: unknown, options: SanitizeOptions = {}): SanitizeResult {
  const maxString = options.maxStringBytes ?? DEFAULT_MAX_STRING;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  let nodes = 0;
  let truncated = false;

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;

    if (++nodes > maxNodes) {
      truncated = true;
      return { __type: "nodes_limit" };
    }

    const kind = typeof value;

    if (kind === "string") {
      const text = value as string;
      if (text.length > INLINE_BASE64_MIN && text.startsWith(DATA_URI_PREFIX)) {
        truncated = true;
        return { __type: "inline_base64", bytes: text.length };
      }
      if (text.length > maxString) {
        truncated = true;
        return { __type: "string", bytes: text.length };
      }
      return text;
    }

    if (kind === "number" || kind === "boolean") return value;
    if (kind === "bigint") return String(value);
    if (kind === "function") return { __type: "function" };
    if (kind !== "object") return String(value);

    try {
      const object = value as object;
      if (isBufferLike(object)) return { __type: "buffer", bytes: (object as Uint8Array).byteLength };
      if (isStreamLike(object)) return { __type: "stream" };
      if (isBlobLike(object)) return { __type: "file", bytes: object.size, mimetype: object.type };
      if (object instanceof Date) return object.toISOString();

      if (Array.isArray(object)) {
        if (depth >= maxDepth) return { __type: "array", length: object.length };
        return object.map((item) => walk(item, depth + 1));
      }

      if (!isRecord(object)) return { __type: "object" };
      if (depth >= maxDepth) return { __type: "object", depth_limit: true };

      const result: Record<string, unknown> = {};
      for (const key of Object.keys(object)) result[key] = walk(object[key], depth + 1);
      return result;
    } catch {
      return { __type: "unserializable" };
    }
  };

  let value: unknown;
  try {
    value = walk(input, 0);
  } catch {
    value = { __type: "unserializable" };
    truncated = true;
  }

  return { value, truncated, nodes };
}
