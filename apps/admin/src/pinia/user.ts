// 这里存放用户的状态信息 和 菜单权限信息
export default defineStore("user", () => {
  const userInfo = reactive<{}>({});
  const menuList = reactive<[]>([]);

  return {
    userInfo,
    menuList,
  };
});
