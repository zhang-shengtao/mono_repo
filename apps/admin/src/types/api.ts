/**
 * 与 apps/services 的 `reply.success / reply.error` 包络一一对应。
 * 形状来自 @repo/shared 的 responseSchema，前端只做消费，不重复维护字段。
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  request_id: string;
}
