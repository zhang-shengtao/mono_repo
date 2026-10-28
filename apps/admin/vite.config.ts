import register_plugins from "./plugin/index.ts";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig((option) => {
  const env = loadEnv(option.mode, import.meta.dirname, "VITE_");
  env.VITE_BASE_NG = path.posix.join("/", env.VITE_BASE_NG || "");
  return {
    plugins: register_plugins(option, env),
    base: env.VITE_BASE_NG,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/admin": {
          target: env.VITE_HTTP_BASE_URL,
          changeOrigin: true,
          // base 与代理前缀都是 /admin，dev 下会把页面自身（以及 /admin/@vite/client）
          // 一起转给后端。这里让「页面导航 + Vite 自身资源」旁路掉代理，只代理真正的接口请求。
          bypass: (req: any) => {
            if (req.method !== "GET") return;
            const url: string = req.url ?? "";
            const accept: string = String(req.headers?.accept ?? "");
            const isPage = accept.includes("text/html");
            const isViteOwn =
              url.startsWith("/admin/@") ||
              url.includes("/src/") ||
              /\.(js|mjs|ts|vue|css|scss|svg|png|jpe?g|gif|ico|woff2?|ttf|json|map)(\?|$)/.test(url);
            if (isPage || isViteOwn) return url;
            return;
          },
        },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      assetsDir: "assets",
    },
  };
});
