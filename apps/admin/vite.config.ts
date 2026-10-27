import register_plugins from "./plugin";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig((option) => {
  return {
    plugins: register_plugins(option),
    base: import.meta.env.VITE_BASE_NG,
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/admin": { target: import.meta.env.VITE_HTTP_BASE_URL, changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      assetsDir: "assets",
    },
  };
});
