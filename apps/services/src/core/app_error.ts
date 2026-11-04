import type { BusinessCode } from "@repo/shared";

export class AppError extends Error {
  constructor(
    public code: BusinessCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function describeError(error: unknown) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `（上游原因：${error.cause.message}）` : "";
  return `${error.message}${cause}`;
}
