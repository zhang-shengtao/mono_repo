/**
 * 子进程拿到一行后做的全部加工：解析 → 脱敏 → 补 time。
 *
 * 单独成模块（而不是塞进 child-main）是为了可单测：
 * 这里最容易出错（时间从 ts 生成、脱敏后重新序列化、字段顺序、路由判定）。
 */
import { jsonInner } from "./object.js";
import { createRedactor, DEFAULT_REDACT_PATHS, type Redactor } from "./redact.js";
import { formatLogTime } from "./time.js";
import { peekHeader } from "./line.js";
import type { LogDirKey } from "./types.js";

export interface TransformOptions {
  /** 脱敏路径，空数组用内置默认 */
  paths?: string[];
  censor?: string;
  now?: () => number;
}

export interface TransformResult {
  /** 最终落盘的一行；字段顺序固定为 level / time / ts / … */
  line: string;
  ts: number;
  dirKey: LogDirKey;
}

export function createRecordTransform(options: TransformOptions = {}): (line: string) => TransformResult | null {
  const paths = options.paths && options.paths.length > 0 ? options.paths : DEFAULT_REDACT_PATHS;
  const redactor: Redactor = createRedactor(paths, options.censor ?? "[Redacted]");
  const now = options.now ?? (() => Date.now());

  return (line: string): TransformResult | null => {
    let record: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
      record = parsed as Record<string, unknown>;
    } catch {
      return null;
    }

    const ts = typeof record.ts === "number" ? record.ts : now();
    const redacted = redactor(record);
    const { level, ts: _rawTs, ...rest } = redacted;

    const levelText = JSON.stringify(typeof level === "string" ? level : "info");
    const head = `{"level":${levelText},"time":"${formatLogTime(new Date(ts))}","ts":${ts}`;
    const restText = jsonInner(rest);
    const out = restText ? `${head},${restText}}` : `${head}}`;

    return {
      line: out,
      ts,
      dirKey: peekHeader(out).dirKey,
    };
  };
}
