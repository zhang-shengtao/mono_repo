import { env } from "@/core/env";
import { buildApp } from "./app";
const app = await buildApp();

try {
  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
  console.log("启动成功：", `http://localhost:${env.PORT}`);
} catch (error) {
  app.log.error({ tip: "启动服务失败", error });
  process.exit(1);
}
