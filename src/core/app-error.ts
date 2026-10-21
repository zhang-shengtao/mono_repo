export const BusinessCode = {
  /** 成功：请求处理成功 */
  SUCCESS: 200,

  /** 通用错误：请求参数不符合接口要求 */
  PARAM_ERROR: 400,
  /** 通用错误：未登录、登录状态无效或认证失败 */
  UNAUTHORIZED: 401,
  /** 通用错误：当前账号无权限访问该资源 */
  FORBIDDEN: 403,
  /** 通用错误：请求的接口或资源不存在 */
  NOT_FOUND: 404,
  /** 通用错误：请求方法不允许 */
  METHOD_NOT_ALLOWED: 405,
  /** 通用错误：请求资源冲突 */
  CONFLICT: 409,
  /** 通用错误：上传文件超过大小限制 */
  PAYLOAD_TOO_LARGE: 413,
  /** 通用错误：请求内容类型不支持 */
  UNSUPPORTED_MEDIA_TYPE: 415,
  /** 通用错误：服务器内部异常 */
  INTERNAL_ERROR: 500,
  /** 通用错误：响应数据不符合接口文档定义 */
  RESPONSE_FORMAT_ERROR: 500,
  /** 通用错误：第三方服务或上游服务调用失败 */
  BAD_GATEWAY: 502,
  /** 通用错误：服务暂时不可用 */
  SERVICE_UNAVAILABLE: 503,

  /** 管理员认证：用户名或密码错误 */
  ADMIN_LOGIN_FAILED: 401,
  /** 管理员认证：管理员账号已被禁用 */
  ADMIN_DISABLED: 403,
  /** 管理员认证：管理员令牌已过期 */
  ADMIN_TOKEN_EXPIRED: 401,

  /** 用户业务：用户不存在 */
  USER_NOT_FOUND: 404,
  /** 用户业务：用户账号已被禁用 */
  USER_DISABLED: 403,

  /** 文件业务：上传文件超过大小限制 */
  FILE_TOO_LARGE: 413,
  /** 文件业务：上传文件类型不允许 */
  FILE_TYPE_INVALID: 415,

  /** 实时通信：SSE 或 WebSocket 连接失败 */
  REALTIME_CONNECT_FAILED: 503,
  /** 实时通信：SSE 或 WebSocket 消息格式无效 */
  REALTIME_MESSAGE_INVALID: 400,

  /** 第三方服务：外部服务调用失败 */
  THIRD_PARTY_ERROR: 502,
} as const;

export type BusinessCode = (typeof BusinessCode)[keyof typeof BusinessCode];

export class AppError extends Error {
  constructor(
    public code: BusinessCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
