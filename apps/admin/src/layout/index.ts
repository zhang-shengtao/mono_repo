// 这个文件就是layout布局组件的状态信息公共变量，如果需要在本地缓存里加载历史布局信息可以在这个文件加逻辑

import { userPinia } from "@/pinia";
const { userInfo, menuList } = userPinia();

// 这个对象是用来存储布局组件的状态信息的 里面包含了布局组件的所有状态信息 方便在其他地方使用
export default reactive({
  isCollapse: false, // 菜单是否折叠
  theme: "light", // 主题
  layoutStyle: "side", // 布局风格 side top mix
  switchPageStyle: "zoom", // 是否切换页面方式 zoom缩放 fadeIn淡入 3D带有3D效果的切换
  isShowBreadcrumbs: true, // 是否显示面包屑
  isShowTabs: true, // 是否显示标签页
  isShowLogo: true, // 是否显示logo
  userInfo, // 用户信息
  menuList, // 路由信息用于ui显示的
});
