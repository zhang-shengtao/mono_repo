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
        "/admin": { target: env.VITE_HTTP_BASE_URL, changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      assetsDir: "assets",
    },
  };
});
