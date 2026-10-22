import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const servicesDir = fileURLToPath(new URL("../services", import.meta.url));

/**
 * 开发期不做 CORS：services 没有注册 @fastify/cors，
 * 所以前端一律同源请求，由 vite 代理把 /admin、/api 转发到 fastify。
 *
 * 代理目标按这个顺序取：
 *   1. 本包 .env.local 里的 VITE_PROXY_TARGET（显式配置优先）
 *   2. apps/services 的 .env / .env.local / .env.example 里的 PORT
 *   3. http://localhost:3000
 * 后两步是为了后端改端口时前端不用跟着改。
 */
function resolveProxyTarget(mode: string): string {
  const explicit = loadEnv(mode, process.cwd(), "").VITE_PROXY_TARGET;
  if (explicit) return explicit;

  for (const file of [".env", ".env.local", ".env.example"]) {
    const envPath = path.join(servicesDir, file);
    if (!existsSync(envPath)) continue;
    const matched = /^PORT=(\d+)\s*$/m.exec(readFileSync(envPath, "utf8"));
    if (matched) return `http://localhost:${matched[1]}`;
  }
  return "http://localhost:3000";
}

export default defineConfig(({ mode }) => {
  const target = resolveProxyTarget(mode);

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/admin": { target, changeOrigin: true },
        "/api": { target, changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
    },
  };
});
