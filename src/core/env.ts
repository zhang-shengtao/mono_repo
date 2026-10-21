import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_DIR: z.string().default("logs"),
  LOG_LARGE_REQUEST_PAYLOAD: z.coerce.boolean().default(false),
  LOG_LARGE_RESPONSE_PAYLOAD: z.coerce.boolean().default(false),
  MYSQL_URL: z.string().min(1),
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

export const env = envSchema.parse(process.env);
