// 样式引入顺序是硬约束：
//   1. tailwind.css  —— @layer 里的 preflight / utilities（EP 未分层，会盖过它）
//   2. EP 样式       —— 组件与暗色变量（未分层）
//   3. global.scss   —— @use theme.scss，我们的令牌必须排在 EP 之后才能覆盖 --el-*
import "virtual:svg-icons-register";
import "./assets/tailwind.css";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "./assets/global.scss";

import directive from "./directive";
import router from "./router";
import pinia from "./pinia";
import App from "./view/index.vue";

const app = createApp(App);

app.config.idPrefix = "my-app";

// pinia 必须先于 router：路由组件（壳）会用到 store
app.use(pinia);
app.use(router);
app.use(directive);

router.isReady().finally(() => app.mount("#app"));
