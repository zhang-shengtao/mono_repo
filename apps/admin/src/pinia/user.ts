// 这里存放用户的状态信息 和 菜单权限信息  这里需要把最终的menuList权限路由数据计算好，到时候页面需要怎么展示再具体组件里拆分数据
export default defineStore("user", () => {
  const userInfo = reactive<{}>({});
  const menuList = reactive<[]>([]);

  return {
    userInfo,
    menuList,
  };
});
