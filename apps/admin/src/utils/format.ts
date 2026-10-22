/** 时间 / 文本格式化工具 */

const pad = (value: number) => String(value).padStart(2, "0");

/** 后端返回的是 ISO 字符串（带时区），这里统一成本地 YYYY-MM-DD HH:mm:ss */
export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 空值统一显示成短横线，避免表格里出现 null / 空白 */
export function orDash(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
