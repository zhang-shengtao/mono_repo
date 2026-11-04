import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    icon?: string;
    hidden?: boolean;
    keepAlive?: boolean;
    isScreen?: boolean;
    target?: boolean;
  }
}
