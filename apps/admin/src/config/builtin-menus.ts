/**
 * 内置菜单。
 *
 * admin_menus 表还没有任何页面记录时（首次部署 / 还没配菜单），超管用这棵树兜底，
 * 保证后台本身可用。它只在「菜单表里有 0 个页面节点」时生效，一旦通过「菜单管理」
 * 建好自己的菜单，就以数据库为准。
 *
 * id 用负数，避免和自增主键混淆；这些 id 不会发给后端。
 */
import type { MenuNode, MenuType } from "@/types/menu";

interface BuiltinMenuInput {
  id: number;
  type: MenuType;
  parentId: number;
  sort: number;
  title: string;
  icon?: string;
  path?: string;
  name?: string;
  permission?: string;
  children?: BuiltinMenuInput[];
}

function toMenuNode(input: BuiltinMenuInput): MenuNode {
  const meta: MenuNode["meta"] = { title: input.title };
  if (input.icon) meta.icon = input.icon;
  if (input.path) meta.path = input.path;
  if (input.name) meta.name = input.name;

  return {
    admin_menus_id: input.id,
    type: input.type,
    parent_id: input.parentId,
    meta,
    permission: input.permission ?? null,
    sort: input.sort,
    is_disabled: false,
    created_at: "",
    updated_at: "",
    children: (input.children ?? []).map(toMenuNode),
  };
}

const BUILTIN_TREE: BuiltinMenuInput[] = [
  {
    id: -100,
    type: "directory",
    parentId: 0,
    sort: 10,
    title: "系统管理",
    icon: "Setting",
    path: "/system",
    name: "System",
    children: [
      {
        id: -110,
        type: "page",
        parentId: -100,
        sort: 1,
        title: "用户管理",
        icon: "User",
        path: "/system/user",
        name: "SystemUser",
        permission: "system:user:get",
        children: [
          {
            id: -111,
            type: "button",
            parentId: -110,
            sort: 1,
            title: "新增用户",
            permission: "system:user:add",
          },
          {
            id: -112,
            type: "button",
            parentId: -110,
            sort: 2,
            title: "编辑用户",
            permission: "system:user:put",
          },
          {
            id: -113,
            type: "button",
            parentId: -110,
            sort: 3,
            title: "删除用户",
            permission: "system:user:delete",
          },
          {
            id: -114,
            type: "button",
            parentId: -110,
            sort: 4,
            title: "查看用户权限",
            permission: "system:user:permission:get",
          },
          {
            id: -115,
            type: "button",
            parentId: -110,
            sort: 5,
            title: "分配用户权限",
            permission: "system:user:permission:put",
          },
        ],
      },
      {
        id: -120,
        type: "page",
        parentId: -100,
        sort: 2,
        title: "菜单管理",
        icon: "Menu",
        path: "/system/menu",
        name: "SystemMenu",
        permission: "system:menu:get",
        children: [
          {
            id: -121,
            type: "button",
            parentId: -120,
            sort: 1,
            title: "新增菜单",
            permission: "system:menu:add",
          },
          {
            id: -122,
            type: "button",
            parentId: -120,
            sort: 2,
            title: "修改菜单",
            permission: "system:menu:put",
          },
          {
            id: -123,
            type: "button",
            parentId: -120,
            sort: 3,
            title: "删除菜单",
            permission: "system:menu:delete",
          },
        ],
      },
      {
        id: -130,
        type: "page",
        parentId: -100,
        sort: 3,
        title: "权限码",
        icon: "Key",
        path: "/system/code",
        name: "SystemCode",
        permission: "system:code:get",
        children: [
          {
            id: -131,
            type: "button",
            parentId: -130,
            sort: 1,
            title: "启停权限码",
            permission: "system:code:put",
          },
        ],
      },
    ],
  },
];

export const BUILTIN_MENUS: MenuNode[] = BUILTIN_TREE.map(toMenuNode);
