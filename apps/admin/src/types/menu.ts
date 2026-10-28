/**
 * 菜单相关的纯类型（编译期擦除，不参与运行时依赖）
 *
 * 形状对齐后端 admin_menus（type / meta / permission），
 * 布局只消费 userPinia().menuList，不关心数据从哪来。
 */

export type MenuType = "directory" | "page" | "button";

export interface MenuMeta {
  /** 菜单 / 页签 / 面包屑文字 */
  title: string;
  /** MyIcon 名称：EP 图标名（Odometer）或本地 svg（svg:github） */
  icon?: string;
  /** 菜单右侧小徽标 */
  badge?: string;
  /** 不进菜单、不进页签 */
  hidden?: boolean;
  /** 固定页签，不可关闭 */
  affix?: boolean;
  /** 是否 keep-alive 缓存，默认 true */
  keepAlive?: boolean;
  /** 页面占满内容区（去掉统一内边距） */
  isScreen?: boolean;
  /** 菜单点击新窗口打开 */
  target?: boolean;
  /** 详情页高亮哪个菜单 */
  activeMenu?: string;
  /** 权限码点位，后端下发菜单时用 */
  permission?: string;
}

export interface MenuItem {
  path: string;
  name?: string;
  type?: MenuType;
  meta: MenuMeta;
  children?: MenuItem[];
}
