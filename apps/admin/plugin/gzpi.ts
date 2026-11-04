import path from "node:path";
import compression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

export default function () {
  return [
    compression({
      threshold: 500 * 1024 + 1,
      filter: () => true,
      deleteOriginFile: false,
    }),
    visualizer({
      filename: path.resolve(import.meta.dirname, "../stats.html"),
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      emitFile: false,
      open: false,
    }),
  ];
}
