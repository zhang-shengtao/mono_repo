import "virtual:svg-icons-register";
import directive from "./directive";
import router from "./router";
import pinia from "./pinia";
import App from "./view/index.vue";

const app = createApp(App);

app.config.idPrefix = "my-app";

app.use(router);
app.use(pinia);
app.use(directive);

router.isReady().finally(() => app.mount("#app"));
