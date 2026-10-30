import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default function () {
  return [
    Components({
      resolvers: [ElementPlusResolver({ importStyle: false })],
      include: [/\.vue$/, /\.vue\?vue/, /\.jsx$/],
      dts: "components.d.ts",
    }),
    AutoImport({
      dts: "auto-imports.d.ts",
      imports: ["vue-router", "vue", "pinia", "@vueuse/core"],
      resolvers: [ElementPlusResolver({ importStyle: false })],
    }),
  ];
}
