// 这个文件是pinia的入口文件 负责创建pinia实例 并导出所有的pinia模块

import { createPinia } from "pinia";
export default createPinia();

export { default as userPinia } from "./user";
