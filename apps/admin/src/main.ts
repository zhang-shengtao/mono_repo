import { createPinia } from "pinia";
import { createApp } from "vue";
import ElementPlus from "element-plus";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "element-plus/dist/index.css";
import "@/styles/index.css";
import App from "@/App.vue";
import router from "@/router";
import { permissionDirective } from "@/directives/permission";

const app = createApp(App);

// pinia 必须先于 router 安装：路由守卫里会读 auth store
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });

// 全量注册图标：菜单的 meta.icon 存的是组件名，侧边栏要靠 <component :is="name"> 动态渲染
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component);
}

app.directive("perm", permissionDirective);
app.mount("#app");
