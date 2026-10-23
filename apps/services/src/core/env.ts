import { z } from "zod";


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
  TRUST_PROXY: envBoolean(false), // 部署在反向代理后面时置为 true，否则 request.ip 拿到的都是代理地址

  BODY_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .default(1024 * 1024),  //请求体大小上限，单位字节

  UPLOAD_MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  API_DOCS_ENABLED: envBoolean(true), // 是否启用 /docs 接口文档

  APP_DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_PREFIX: z.string().default("PREFIX:"),

  ADMIN_JWT_SECRET: z.string().min(1),
  USER_JWT_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().default("7d"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`环境变量校验失败，请检查 .env 文件或启动参数 --env-file：\n${details}`);
}

export const env = parsedEnv.data;
