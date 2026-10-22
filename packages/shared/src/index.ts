// @repo/shared 统一出口。
// 注意：包内相对导入一律带 .js 后缀 —— 产物要能被 Node 原生 ESM 直接加载，Node 不会补扩展名。
//
// 这里只放真正跨端的东西：前端(admin)要拿来做响应拦截判定的业务码，以及统一响应包络的形状。
// 权限码 / 种子数据 / 鉴权类型都是 api 自己的事，放在 apps/services/src/permissions 和
// apps/services/src/types，不要往这里搬 —— 权限码的跨端通道是数据库和 HTTP，不是 npm 包。
export * from "./business-code.js";
export * from "./response.js";
