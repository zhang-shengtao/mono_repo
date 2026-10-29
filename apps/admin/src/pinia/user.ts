import { routes, type RouteRecordRaw } from "@/router";

export interface UserInfo {
  name: string;
  account: string;
  avatar?: string;
}

const DEFAULT_USER_INFO: UserInfo = {
  name: "管理员",
  account: "admin",
};

// 格式化路径
function formatPath(val1: string, val2 = "") {
  if (val1.startsWith("http")) return val1;
  if (val1 && !val1.startsWith("/")) val1 = "/" + val1;
  if (val2 && !val2.startsWith("/")) val2 = "/" + val2;
  return val2 + val1;
}

function menuArr(allArr: RouteRecordRaw[], path = "") {
  if (allArr.length === 0) return [];
  const arr: RouteRecordRaw[] = [];
  allArr.forEach((page) => {
    const item = { ...page };
    if (item.path != "/") item.path = formatPath(item.path, path);
    if (item.children && item.children.length && item.path != "/") {
      item.children = menuArr(item.children, item.path);
    }
    const isChildren = item.path === "/" && item.children && item.children.length;
    if (!(item.meta?.hidden === true)) isChildren ? arr.push(...menuArr(item.children || [])) : arr.push(item);
  });
  return arr;
}

export default defineStore("user", () => {
  const userInfo = ref<UserInfo>({ ...DEFAULT_USER_INFO });

  const menuList = ref<RouteRecordRaw[]>(menuArr(routes));

  return {
    userInfo,
    menuList,
  };
});
