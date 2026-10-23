/** 级别判断与比较的唯一出处 */
import { LEVEL_VALUES, type LogLevel, type LogLevelName } from "./types.js";

export function levelOf(value: unknown): LogLevel | undefined {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEVEL_VALUES, value)
    ? (value as LogLevel)
    : undefined;
}

/** 级别数值：silent / 未知 → Infinity（宁可保留，不可误删） */
export function levelValue(level: LogLevelName | undefined): number {
  if (level === undefined || level === "silent") return Number.POSITIVE_INFINITY;
  return LEVEL_VALUES[level];
}

/** 运行时归一：用于 logger.level 热改与 child() 的 level 覆盖 */
export function resolveLevel(
  level: unknown,
  fallback: { name: LogLevelName; value: number },
): { name: LogLevelName; value: number } {
  if (level === "silent") return { name: "silent", value: Number.POSITIVE_INFINITY };
  const name = levelOf(level);
  return name ? { name, value: LEVEL_VALUES[name] } : fallback;
}
