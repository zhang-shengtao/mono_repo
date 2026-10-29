import "virtual:svg-icons-register";

import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "./assets/global.scss";

import directive from "./directive";
import router from "./router";
import pinia from "./pinia";
import App from "./view/index.vue";

const app = createApp(App);

app.config.idPrefix = "my-app";

app.use(pinia);
app.use(router);
app.use(directive);

router.isReady().finally(() => app.mount("#app"));
