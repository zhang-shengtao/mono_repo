/**
 * 时间相关唯一来源（子进程用它把 ts 格式化成 time、按天切分、算保留截止日）。
 *
 * - 一律本地时区；
 * - 天数计算用 `new Date(y, m, d + n)`，不用毫秒算术（夏令时/时区变化会算错）；
 * - 日期比较用字典序，不转 Date。
 */

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/** `YYYY-MM-DD`（本地时区） */
export function ymd(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD HH:mm:ss`（与历史日志文件格式一致） */
export function formatLogTime(date: Date = new Date()): string {
  return `${ymd(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 平移若干天，保留时分秒 */
export function shiftDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

/** epoch 毫秒 → `YYYY-MM-DD` */
export function dayOfEpoch(epochMs: number): string {
  return ymd(new Date(epochMs));
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}
