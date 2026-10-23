/** 对象 / JSON 的小工具，避免同一段判断散落在 logger、sanitize、redact、request-log 里 */

/** 纯对象判断（排除 null 和数组） */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把对象序列化成「不含外层花括号」的片段；空对象 / null / 序列化失败返回 "" */
export function jsonInner(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    if (!text || text === "{}" || text === "null") return "";
    return text.slice(1, -1);
  } catch {
    return "";
  }
}
