import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string; /** 页签 / 面包屑 / 菜单文字*/
    icon?: string; /** my-icon 名称 */
    hidden?: boolean; /** 不进菜单 / 不进页签 */
    keepAlive?: boolean; /** 是否开启 keep-alive 缓存，默认 true */
    isScreen?: boolean; /** 页面占满内容区 */
    target?: boolean; /** 是否在新窗口打开 */
  }
}
