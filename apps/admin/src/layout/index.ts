// 这个文件是布局组件的入口文件 里面包含了布局组件的所有子组件 方便在其他地方引入

export { default as Header } from "./Header/index.vue";
export { default as MainApp } from "./MainApp/index.vue";
export { default as Menu } from "./Menu/index.vue";

// 这个对象是用来存储布局组件的状态信息的 里面包含了布局组件的所有状态信息 方便在其他地方使用
const layout_info = reactive({
  isCollapse: false, // 菜单是否折叠
  theme: "light", // 主题
  layoutStyle: "side", // 布局风格 side top mix
  switchPageStyle: "zoom", // 是否切换页面方式 zoom缩放 fadeIn淡入 3D带有3D效果的切换
  isShowBreadcrumbs: true, // 是否显示面包屑
  isShowTabs: true, // 是否显示标签页
  isShowLogo: true, // 是否显示logo
});
