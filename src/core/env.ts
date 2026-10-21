import { z } from "zod";

/**
 * 读取布尔型环境变量。
 *
 * 注意：不要用 z.coerce.boolean()，它走的是 Boolean(value)，
 * 字符串 "false" 会被转成 true（Boolean("false") === true）。
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.enum(["true", "false"]).default(defaultValue ? "true" : "false"),
    )
    .transform((value) => value === "true");

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  /** 部署在反向代理后面时置为 true，否则 request.ip 拿到的都是代理地址 */
  TRUST_PROXY: envBoolean(false),
  /** 请求体大小上限，单位字节 */
  BODY_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(1024 * 1024),

  LOG_DIR: z.string().default("logs"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** 是否开放 /docs 接口文档，生产环境建议 false */
  API_DOCS_ENABLED: envBoolean(true),

  APP_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PREFIX: z.string().default("PREFIX:"),

  ADMIN_JWT_SECRET: z.string().min(1),
  USER_JWT_SECRET: z.string().min(1),
  JWT_ISSUER_ADMIN: z.string().default("admin-system"),
  JWT_ISSUER_USER: z.string().default("user-system"),
  ACCESS_TOKEN_TTL: z.string().default("7d"),

  UPLOAD_MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`环境变量校验失败，请检查 .env 文件或启动参数 --env-file：\n${details}`);
}

export const env = parsedEnv.data;
