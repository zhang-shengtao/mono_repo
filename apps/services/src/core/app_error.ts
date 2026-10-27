import type { BusinessCode } from "@repo/shared";

/**
 * 业务异常。
 *
 * 业务码常量（BusinessCode）已下沉到 @repo/shared —— admin 端要靠它区分「密码错误」
 * 和「账号被禁用」这类提示，属于前后端共用的契约。这个类只保留服务端行为。
 */
export class AppError extends Error {
  constructor(
    public code: BusinessCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** 把 unknown 异常整理成一行可读文本，用于启动阶段的兜底输出 */
export function describeError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `（上游原因：${error.cause.message}）` : "";
  return `${error.message}${cause}`;
}
