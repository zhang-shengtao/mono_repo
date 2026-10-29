import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { createSvgIconsPlugin } from "vite-plugin-svg-icons";
import { resolve } from "path";
import AutoImport from "./import.ts";
import type { ConfigEnv } from "vite";

export default function register_plugins(option: ConfigEnv, env: Record<string, string>) {
  return [
    vue(),
    tailwindcss(),
    ...AutoImport(),
    createSvgIconsPlugin({
      iconDirs: [resolve(process.cwd(), "src/assets/icons")],
      symbolId: "app-svg:[name]",
    }),
  ];
}
