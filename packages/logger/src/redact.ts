/**
 * 脱敏：沿敏感路径做「最小克隆」，不改动其它字段。
 *
 * 只在子进程执行 —— 主进程负责把数据送过管道，不在这里花 CPU。
 * 不做原地改写：请求日志会把 headers / body 传进来，原地脱敏等于改写业务数据。
 */
import { isRecord } from "./object.js";

const DEFAULT_PATHS = [
  "headers.authorization",
  "headers.cookie",
  'headers["set-cookie"]',
  "body.password",
  "body.newPassword",
  "body.token",
];

export type Redactor = (record: Record<string, unknown>) => Record<string, unknown>;

interface Group {
  key: string;
  segments: string[][];
}

/** `headers["set-cookie"]` → ["headers","set-cookie"] */
function parsePath(path: string): string[] {
  return path
    .replace(/\[["']([^"']+)["']\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

function cloneAlong(
  container: Record<string, unknown>,
  segments: string[],
  censor: string,
): Record<string, unknown> | null {
  const [head, ...rest] = segments;
  if (!Object.prototype.hasOwnProperty.call(container, head)) return null;
  if (rest.length === 0) return container[head] === censor ? null : { ...container, [head]: censor };

  const child = container[head];
  if (!isRecord(child)) return null;

  const cloned = cloneAlong(child, rest, censor);
  return cloned ? { ...container, [head]: cloned } : null;
}

export function createRedactor(paths: string[] = DEFAULT_PATHS, censor = "[Redacted]"): Redactor {
  const groups = new Map<string, string[][]>();
  for (const path of paths) {
    const segments = parsePath(path);
    if (segments.length < 2) continue;
    const [key, ...rest] = segments;
    groups.set(key, [...(groups.get(key) ?? []), rest]);
  }

  const compiled: Group[] = [...groups].map(([key, segments]) => ({ key, segments }));
  if (compiled.length === 0) return (record) => record;

  return (record) => {
    let result = record;
    for (const group of compiled) {
      const container = result[group.key];
      if (!isRecord(container)) continue;

      let changed: Record<string, unknown> | null = null;
      for (const segments of group.segments) {
        const next = cloneAlong(changed ?? container, segments, censor);
        if (next) changed = next;
      }
      if (!changed) continue;

      if (result === record) result = { ...record };
      result[group.key] = changed;
    }
    return result;
  };
}

export { DEFAULT_PATHS as DEFAULT_REDACT_PATHS };
