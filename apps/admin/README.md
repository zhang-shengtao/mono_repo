# @repo/admin · 管理后台 UI

> **一句话**：本仓库（pnpm workspace + Turborepo）里的管理后台前端应用，**Vue 3 + Vite + TypeScript +
> Element Plus**；登录后的**菜单、路由、按钮权限全部由后端数据库驱动**（`apps/services` 的
> `admin_menus` / `code` / `permissions` 表），前端不内置权限码常量。

| 项目         | 值                                                             |
| ------------ | -------------------------------------------------------------- |
| 包名         | `@repo/admin`（`apps/admin`）                                  |
| 角色         | 可部署应用（纯静态站点）                                       |
| 开发端口     | `5173`（Vite）                                                 |
| 依赖的后端   | `apps/services`，开发期由 Vite 代理 `/admin`、`/api` 转发      |
| 依赖的仓库包 | `@repo/shared`（`workspace:*`，用 `BusinessCode` 做响应判定）  |
| 构建产物     | `apps/admin/dist/`（`index.html` + `assets/` + `favicon.svg`） |

---

## 一、这个项目是干嘛的

一句话：**一个可配置的管理后台外壳**——登录后拉取「当前账号 + 菜单树 + 权限码」，
把菜单树翻译成真实路由挂到布局下，侧边栏按权限渲染，页面内的按钮用 `v-perm` 指令做按钮级权限。

已内置的页面：

| 页面     | 路由             | 说明                                         |
| -------- | ---------------- | -------------------------------------------- |
| 登录     | `/login`         | 账号 + 密码 + SVG 图形验证码                 |
| 仪表盘   | `/dashboard`     | 静态路由，永远存在，作为登录后的默认首页     |
| 用户管理 | `/system/user`   | 列表 / 新增 / 编辑 / 删除 / 分配权限（抽屉） |
| 菜单管理 | `/system/menu`   | 菜单树 CRUD，配置图标、路径、组件、权限码    |
| 权限码   | `/system/code`   | `code` 表（权限码 / 字典）的查询与编辑       |
| 403      | `/403`           | 无访问权限                                   |
| 404      | `/:pathMatch(*)` | 未匹配到任何路由                             |

设计要点：

- **同源请求**：services 没有装 `@fastify/cors`，所以开发期一律走 Vite 代理，生产期交给 Nginx 等反向代理。
- **权限最终事实源是后端**：前端隐藏按钮只是体验，接口返回 403 才算数。
- **空菜单兜底**：`admin_menus` 里还没有页面记录时，超管会看到 `src/config/builtin-menus.ts` 的内置菜单，
  避免空表导致「菜单管理」都进不去；库里出现页面菜单后立即以数据库为准。

---

## 二、目录结构与每个目录的作用

```
apps/admin/
├── src/
│   ├── main.ts                # 入口：pinia → router → Element Plus → 全量注册图标 → 注册 v-perm
│   ├── App.vue                # 根组件（只放 <router-view>）
│   ├── vite-env.d.ts          # Vite 客户端类型
│   ├── api/                   # 所有 HTTP 调用
│   │   ├── http.ts            #   axios 实例 + 统一包络拆包 + 401 处理 + onUnauthorized 钩子
│   │   ├── auth.ts            #   登录 / 登出 / 当前账号 / 当前账号菜单
│   │   ├── user.ts            #   用户管理 CRUD 与权限分配
│   │   ├── menu.ts            #   菜单管理 CRUD
│   │   ├── code.ts            #   权限码 / 字典查询与更新
│   │   └── global.ts          #   验证码、健康检查等
│   ├── types/                 # 类型定义：api.ts（ApiResponse）、auth / user / menu / code
│   ├── stores/                # Pinia
│   │   ├── auth.ts            #   登录态、当前账号、菜单树、权限码、bootstrap / logout / can()
│   │   └── app.ts             #   侧边栏折叠等 UI 状态
│   ├── router/
│   │   ├── index.ts           #   createRouter（createWebHistory）→ 安装守卫 → 注册 401 统一回调
│   │   ├── routes.ts          #   静态路由 + pageRegistry（路径键 → 页面组件）
│   │   ├── menu-routes.ts     #   把数据库菜单树翻译成 addRoute（含组件匹配与回收）
│   │   └── guard.ts           #   登录拦截 → 首次初始化 → 页面级权限校验
│   ├── directives/
│   │   └── permission.ts      # v-perm 按钮级权限指令（字符串或数组「命中任意一个」）
│   ├── layouts/
│   │   ├── AdminLayout.vue    #   外壳：侧边栏 + 顶栏 + 内容区
│   │   └── components/        #   AppBrand / AppHeader / SidebarMenu / SidebarMenuItem / Breadcrumbs
│   ├── components/            # 通用组件：PageHeader、IconPicker
│   ├── views/                 # 页面
│   │   ├── login/             #   登录页
│   │   ├── dashboard/         #   仪表盘
│   │   ├── system/user/       #   用户管理 + UserFormDialog + PermissionDrawer
│   │   ├── system/menu/       #   菜单管理 + MenuFormDialog
│   │   ├── system/code/       #   权限码管理
│   │   └── error/             #   Forbidden(403) / NotFound(404) / MissingPage(组件未实现)
│   ├── utils/                 # token（localStorage）、menu 树工具、dict、format
│   ├── config/
│   │   └── builtin-menus.ts   # 菜单表为空时的内置菜单兜底
│   └── styles/
│       └── index.css          # 设计令牌 + 外壳 + 骨架 + Element Plus 覆写
├── public/
│   └── favicon.svg            # 原样拷贝到 dist/
├── index.html                 # Vite 入口 HTML
├── vite.config.ts             # 端口、@ 别名、/admin 与 /api 代理、构建配置
├── tsconfig.json              # noEmit + DOM lib + @/* → ./src/*
├── .env.example               # VITE_API_BASE / VITE_PROXY_TARGET / VITE_APP_TITLE 模板
├── dist/                      # 构建产物（不入库）
└── package.json               # dev / build / preview / typecheck
```

几处容易忽略的约定：

- `api/` 里的方法只负责发请求，**不弹通用错误提示**：错误提示与 401 跳登录统一由 `http.ts` 处理。
- 页面组件**不在 `routes.ts` 里静态 import**，而是登记进 `pageRegistry`（按路径键懒加载），
  这样数据库里的菜单路径能直接映射到组件。
- `views/system/*/` 下的对话框（`*Dialog.vue`、`*Drawer.vue`）跟着页面走，不进全局 `components/`。

---

## 三、技术栈

| 分类      | 选型                                               | 用途                                                     |
| --------- | -------------------------------------------------- | -------------------------------------------------------- |
| 框架      | Vue 3.5（`<script setup>` + Composition API）      | 页面与组件                                               |
| 构建      | Vite 8 + `@vitejs/plugin-vue`                      | 开发服务器（HMR）与生产构建                              |
| 语言      | TypeScript 6.x                                     | 版本由仓库 `catalog:` 统一；`vue-tsc` 做 `.vue` 类型检查 |
| UI 组件库 | Element Plus 2.14（中文 locale）                   | 表格、表单、弹窗、抽屉、消息提示等                       |
| 图标      | `@element-plus/icons-vue`                          | **全量注册**，菜单的 `meta.icon` 存组件名后动态渲染      |
| 路由      | Vue Router 5                                       | 静态路由 + 登录后动态挂载数据库菜单                      |
| 状态      | Pinia 4                                            | 登录态、菜单、权限码、UI 状态                            |
| 请求      | Axios 1.20                                         | 拦截器统一注入 token、拆响应包络、处理错误               |
| 共享契约  | `@repo/shared`                                     | `BusinessCode`（业务码）与响应包络 schema                |
| 代码规范  | Prettier（仓库根统一配置）+ `.githooks/pre-commit` | 在仓库根执行 `pnpm format` / `pnpm check`                |

> Element Plus 与图标都是**全量引入**（简单、动态渲染无需额外配置），代价是首屏包更大。
> 若以后要瘦身，再引入 `unplugin-vue-components` / `unplugin-auto-import` 做按需导入。

---

## 四、怎么跑起来、怎么打包

### 4.1 开发

```bash
# 1. 先把后端跑起来（需要 PostgreSQL + Redis）
pnpm dev:services

# 2. 再起前端
pnpm dev:admin                    # 仓库根 = turbo dev --filter=@repo/admin
```

- 前端：`http://localhost:5173`
- 后端端口以 `apps/services/.env` 的 `PORT` 为准，前端不用改：代理目标按顺序取
  `apps/admin/.env.local` 的 `VITE_PROXY_TARGET` → `apps/services/.env` / `.env.local` / `.env.example` 的 `PORT`
  → `http://localhost:3000`。
- 首次登录：账号 `admin`，密码取 `ADMIN_SEED_PASSWORD`（未设置时为 `123456`）；
  账号来自 `pnpm db:seed:admin`，权限码来自 `pnpm db:seed:permissions`。

环境变量（`.env.example` → 复制成 `.env.local`，不入库）：

| 变量                | 默认       | 说明                                                         |
| ------------------- | ---------- | ------------------------------------------------------------ |
| `VITE_API_BASE`     | 空         | 请求前缀。留空 = 同源（开发靠 Vite 代理，生产靠 Nginx 转发） |
| `VITE_PROXY_TARGET` | 自动       | 强制指定开发代理目标；不填就自动读后端 `.env` 的 `PORT`      |
| `VITE_APP_TITLE`    | `管理后台` | 浏览器标签页标题（路由守卫里拼 `页面名 · 标题`）             |

### 4.2 打包

```bash
pnpm build                                   # 仓库根：turbo 按依赖顺序构建所有包
pnpm --filter @repo/admin build              # 只构建前端
pnpm --filter @repo/admin preview            # 本地预览产物（默认 4173）
```

`build` 脚本是 `vue-tsc --noEmit -p tsconfig.json && vite build`：

1. `vue-tsc --noEmit` 先做**全量类型检查（含 `.vue`）**，有类型错误直接失败，不产出半成品；
2. `vite build` 把 `index.html`、`public/`、`src/` 打包进 `dist/`；
3. 产物是纯静态文件（`dist/index.html`、`dist/assets/*`、`dist/favicon.svg`）；类型检查用 `--noEmit`，不产出任何 JS。

注意：`turbo.json` 里 `build` 的 `outputs` 是 `dist/**`，缓存命中时 dist 会被还原；
改了 Vite 的输出目录（`build.outDir`）要同步改 `turbo.json`，否则缓存命中会拿不到产物。

### 4.3 部署

产物没有任何 Node 运行时依赖，**把 `dist/` 丢给任何静态服务器即可**，关键是两件事：

1. **SPA 回退**：本项目用 `createWebHistory`（history 模式），所以非 `/` 路径都要回退到 `index.html`。
   Nginx 示例：

   ```nginx
   root /var/www/admin/dist;
   location / {
     try_files $uri $uri/ /index.html;
   }

   # 后端同源转发（与开发期的 Vite 代理对应）
   location /admin/ { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
   location /api/   { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
   ```

2. **接口地址**：默认 `VITE_API_BASE` 为空 = 同源请求，所以要么像上面那样由 Nginx 转发 `/admin`、`/api`，
   要么在**构建时**设 `VITE_API_BASE=https://api.example.com` 走跨域（那就得给后端的反代加 CORS）。
   `VITE_*` 变量是**构建期注入**的，改完必须重新 build，不是运行时配置。

构建产物请按版本整目录替换（不要和旧 `assets/` 混放），浏览器缓存由文件名 hash 兜底。

### 4.4 命令速查

| 命令                                  | 说明                               |
| ------------------------------------- | ---------------------------------- |
| `pnpm dev:admin`                      | 开发服务器（5173，带代理）         |
| `pnpm --filter @repo/admin build`     | 类型检查 + 生产构建到 `dist/`      |
| `pnpm --filter @repo/admin typecheck` | 只做类型检查（`vue-tsc --noEmit`） |
| `pnpm --filter @repo/admin preview`   | 预览构建产物                       |

> Vite 在 Windows 上会 `exec` 子进程解析真实路径。若在受限沙箱里跑 `vite build` 报 `spawn EPERM`，
> 放开沙箱执行即可，不是项目问题。

---

## 五、菜单与权限模型

### 5.1 菜单 meta 契约

后端只校验 `title`（必填）、`path`（以 `/` 开头）、`name`（全局唯一），其余字段原样存储，前端按约定解读：

| 字段        | 谁用                       | 说明                                                                  |
| ----------- | -------------------------- | --------------------------------------------------------------------- |
| `title`     | 侧边栏 / 面包屑 / 403 提示 | 必填                                                                  |
| `icon`      | 侧边栏                     | `@element-plus/icons-vue` 的组件名，如 `User`；全量注册所以能动态渲染 |
| `path`      | 路由                       | 目录 / 页面必填，如 `/system/user`                                    |
| `name`      | 路由名                     | 目录 / 页面必填，全局唯一，如 `SystemUser`                            |
| `component` | 路由 → 组件                | 可选。填了优先用；留空则按 `path` 自动匹配 `pageRegistry`             |

组件匹配顺序：`meta.component` → `meta.path` 去掉前导 `/` 的键 → 再加一层 `/index` → `MissingPage` 兜底页。

只有 `type === "page"` 的节点会生成路由（`directory` 只是分组，`button` 是权限点）。

### 5.2 权限

- **页面**：菜单的 `permission` 进入路由 `meta.permission`，守卫不满足 → `/403`。
- **按钮**：`<el-button v-perm="'system:user:add'">`，传数组表示「命中任意一个」。
  权限码来源是 `/admin/user/menus` 返回菜单树里的 `permission`，**不要 import 后端常量**。
- **超管**：`parent_id === 0` 一律放行（后端同样逻辑）。
- **刷新后重建**：路由守卫首次进入时 `auth.bootstrap()` 拉账号与菜单 → `installMenuRoutes()` 挂动态路由
  → 重走一次导航；登出时回收动态路由。

### 5.3 空菜单兜底

`admin_menus` 表里还没有页面记录时，超管会看到 `src/config/builtin-menus.ts` 的内置菜单（顶栏有「内置菜单」标记），
否则空表会导致「菜单管理」都进不去。所以**首次配置请一次性把三个页面菜单都建好**
（用户管理 / 菜单管理 / 权限码），否则入口会在「内置菜单」和「数据库菜单」之间切换丢失。

### 5.4 新增页面

1. 写 `src/views/<module>/<page>/index.vue`（用 `PageHeader` + `card` 骨架）。
2. 在 `src/router/routes.ts` 的 `pageRegistry` 登记键：`"system/xxx": () => import(...).then(m => m.default)`。
3. 到后台「菜单管理」新增 `type = page`：路径 `/system/xxx`、路由名 `SystemXxx`、绑定权限码。
4. 页面内操作按钮加 `v-perm`，权限码去「权限码」页维护。

---

## 六、常见问题

| 现象                        | 原因 / 处理                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| 登录后 502 / `ECONNREFUSED` | 后端没起，或端口和 `apps/services/.env` 的 `PORT` 不一致；看终端代理报错里的端口 |
| 侧边栏空 / 只有内置菜单     | `admin_menus` 里没有页面记录，去「菜单管理」建；见上面「空菜单兜底」             |
| 页面 404                    | 菜单的 `path` 没匹配到路由：路径要以 `/` 开头且和 `pageRegistry` 键一致          |
| 出现「页面组件未实现」      | 路由已注册但组件没匹配到：补 `meta.component` 或注册 `pageRegistry`              |
| 401 后一直跳登录            | 后端 Redis 里会话过期（默认 `ACCESS_TOKEN_TTL`），重新登录即可                   |
| 按钮不显示                  | 没有对应按钮权限码；超管不会隐藏，子账号需要在「用户管理 → 权限」里分配          |
| 刷新页面变 404              | 生产静态服务器没配 SPA 回退，见「部署 → SPA 回退」                               |
| 改了接口地址没生效          | `VITE_*` 是构建期变量，必须重新 `build`                                          |
