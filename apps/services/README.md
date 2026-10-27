# @repo/services · 后端 API 服务

> **一句话**：本仓库（pnpm workspace + Turborepo）里唯一的后端应用，基于 **Fastify 5 + TypeScript +
> PostgreSQL（Drizzle ORM）+ Redis** 提供 REST API，是 `apps/admin` 管理后台的数据来源；
> `pnpm build` 会产出可以单独拷到服务器、只靠 npm 就能跑起来的 `dist/`。

| 项目         | 值                                                                                   |
| ------------ | ------------------------------------------------------------------------------------ |
| 包名         | `@repo/services`（`apps/services`）                                                  |
| 角色         | 可部署应用（不是被引用的库）                                                         |
| 运行环境     | Node.js >= 25、PostgreSQL >= 14、Redis >= 6                                          |
| 默认端口     | `.env` 的 `PORT`（模板 3000）                                                        |
| 接口文档     | `http://localhost:<PORT>/docs`（`API_DOCS_ENABLED=false` 时关闭）                    |
| 构建产物     | `apps/services/dist/`（既是编译输出，也是一个完整的 Node 项目）                      |
| 依赖的仓库包 | `@repo/shared`、`@repo/logger`（`workspace:*`，构建时自动 vendor 进 `dist/vendor/`） |

---

## 一、这个项目是干嘛的

一句话：**一个自带认证、权限、日志、接口文档和数据库同步能力的 Fastify 后端脚手架**，业务功能按模块挂在
`src/modules/<module>/` 下。

| 能力       | 说明                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| 管理端接口 | `/admin/*`：管理员登录/登出、账号增删改查、权限分配、菜单 CRUD、权限码查询、图形验证码     |
| 开放端接口 | `/api/*`：健康检查、示例 SSE 对话、示例 WebSocket、示例 AI 接口                            |
| 身份认证   | 两套独立 JWT（admin / user），密钥与 issuer 分离，由路由的 `config.auth` 决定用哪一套      |
| 权限控制   | `config.auth.permission` 编译期类型检查 + 运行时查库；菜单 / 按钮权限全部由数据库驱动      |
| 数据访问   | PostgreSQL（Drizzle ORM，表结构即 `src/db/*.ts`）+ Redis（验证码、会话等）                 |
| 接口文档   | `@fastify/swagger` 生成 OpenAPI 3.0，`@scalar/fastify-api-reference` 渲染 `/docs`          |
| 结构化日志 | `@repo/logger`：子进程写盘，按天切分 + 10MB 分卷 + 只留 30 天；脱敏在子进程做              |
| 独立部署   | `dist/` 带真实依赖版本、`drizzle.config.mjs` 和 `db:*` 脚本，`npm install --omit=dev` 即可 |

已实现的业务模块（接口清单，均定义在 `src/modules/<module>/<module>.route.ts`）：

| 模块      | 主要接口                                                                                                                                                                    | 干什么                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `user`    | `GET/POST/PUT /admin/user/list`、`DELETE /admin/user/list/:user_id`、`GET/PUT .../permissions`、`GET /admin/user/info`、`POST /admin/user/login`、`POST /admin/user/logout` | 管理员账号管理与登录              |
| `menu`    | `GET/POST/PUT /admin/menu/list`、`DELETE /admin/menu/list/:admin_menus_id`、`GET /admin/user/menus`                                                                         | 动态菜单树（前端路由 / 按钮权限） |
| `code`    | `GET /admin/code/list`、`PUT /admin/code/list`、`GET /admin/code/filter`                                                                                                    | 权限码 / 字典数据                 |
| `global`  | `GET /api/health/ready`、`GET /admin/captcha/image`                                                                                                                         | 健康检查、SVG 图形验证码          |
| `example` | `POST /admin/example/login`、`POST /api/example/chat`（SSE）、`GET /api/example/ws`（WebSocket）                                                                            | 实时通信与登录流程的示例          |
| `ai`      | `GET /api/ai/detail`                                                                                                                                                        | AI 相关示例接口                   |

---

## 二、目录结构与每个目录的作用

```
apps/services/
├── src/                          # 源码（tsconfig 的 rootDir，编译后原样映射到 dist/）
│   ├── server.ts                 # 进程入口：启动、启动失败兜底、SIGINT/SIGTERM 优雅停机、退出前 flush 日志
│   ├── app.ts                    # 应用装配：logger / bodyLimit / trustProxy / 校验器 / autoload 插件和路由
│   ├── core/                     # 与业务无关的基础设施
│   │   ├── env.ts                #   环境变量 schema（zod），缺失或非法时在启动阶段给出可读原因
│   │   ├── app_error.ts          #   AppError / describeError（错误归一）
│   │   ├── error_handler.ts      #   统一错误响应，保留 HTTP 语义
│   │   ├── response.ts           #   reply.success / reply.error / x-request-id
│   │   ├── request_log.ts        #   访问日志的字段整理与脱敏
│   │   └── paths.ts              #   包根定位（server.ts 据此决定日志目录）
│   ├── db/                       # 数据层
│   │   ├── admin_user.ts         #   表 admin_user
│   │   ├── admin_menus.ts        #   表 admin_menus
│   │   ├── permissions.ts        #   表 permissions
│   │   ├── code.ts               #   表 code（权限码 / 字典）
│   │   └── script/               #   一次性脚本（不会被当成 schema，能编进 dist）
│   │       ├── push-db.ts        #     db:push：drizzle-kit push，schema ↔ 活库 diff 后执行 DDL
│   │       ├── admin-user.ts     #     db:seed:admin：初始化管理员账号（会重置密码，只手动跑）
│   │       └── permissions.ts    #     db:seed:permissions：把权限码种子同步进 code 表
│   ├── modules/<module>/         # 业务模块，一个模块三个文件
│   │   ├── <module>.route.ts     #   路由声明：路径 + 鉴权 + zod schema + 调用 service
│   │   ├── <module>.schema.ts    #   请求/响应 schema 与路由配置（自动生成 OpenAPI）
│   │   └── <module>.service.ts   #   业务逻辑与 SQL
│   ├── plugins/                  # Fastify 插件，按文件名注册：jwt / logger / multipart /
│   │                             #   postgres / redis / swagger / websocket
│   ├── permissions/              # 权限码常量与种子数据（index.ts 汇总，menu.ts / user.ts 分域）
│   ├── types/                    # auth.ts（RouteAuthConfig 判别联合）、fastify.d.ts（实例类型增强）
│   └── utils/                    # 分页器、密码哈希、日志时间格式化等
├── scripts/                      # 仓库内工具脚本（不在 src 别名与类型检查范围内）
│   ├── build.ts                  #   打包脚本：tsc → tsc-alias → 清理 sourcemap → vendor 本地包 → 生成 dist/package.json
│   ├── workspace-vendor.ts       #   vendor 逻辑：按 package.json 自动识别 workspace 依赖，不写死包名
│   └── gen_module.ts             #   gen:module：生成新业务模块脚手架
├── logs/                         # 运行期日志（按天切分，不入库）
├── dist/                         # 构建产物（build 每次清空，不入库）
├── .env.example                  # 环境变量模板；复制成 .env 使用，.env 不入库
├── drizzle.config.ts             # drizzle-kit 配置：schema = src/db/*.ts，连库读 APP_DATABASE_URL
├── fastify-core-plugins-cn.md    # Fastify Core Plugins 中文速查（社区中文站整理，写插件前先查）
├── tsconfig.json                 # module ESNext / moduleResolution Bundler / @/* → ./src/*
└── package.json                  # dev / build / typecheck / gen:module / db:* 脚本与依赖
```

几条读目录时容易踩的点：

- `src/db/*.ts` **只放表定义**：顶层 `*.ts` 会被 drizzle-kit 当成 schema（`schema: "src/db/*.ts"`）。
  工具脚本一律放子目录 `src/db/script/`，否则会被当成表。
- `plugins/`、`modules/` 都由 `@fastify/autoload` 自动加载：插件按文件名加载，业务路由只匹配 `*.route.ts`。
  新增文件不用改 `app.ts`，但**文件名必须符合约定**。
- `scripts/` 不在 `tsconfig.json` 的 `include`（只有 `src/**/*.ts`）里，所以其中不能用 `@/` 别名，
  要写相对路径（`../src/db/code`），也不会进 `dist/`。

---

## 三、技术栈

| 分类       | 选型                                                             | 用途                                      |
| ---------- | ---------------------------------------------------------------- | ----------------------------------------- |
| 运行时     | Node.js >= 25（原生 ESM、`--env-file`、`--watch`）               | 不依赖 dotenv / nodemon                   |
| 语言       | TypeScript 6.x（`strict` + `verbatimModuleSyntax`）              | 版本由仓库 `catalog:` 统一，不在本包写死  |
| Web 框架   | Fastify 5.x + `@fastify/autoload`                                | 路由与插件按目录自动加载                  |
| 参数校验   | Zod 4 + `fastify-type-provider-zod`                              | 校验器/序列化器 + 由 schema 生成 OpenAPI  |
| 数据库     | PostgreSQL + Drizzle ORM 0.45 / drizzle-kit 0.31                 | 表结构用 TS 描述，`push` 直接同步库       |
| 缓存       | Redis（`@fastify/redis`）                                        | 验证码、会话等                            |
| 认证       | `@fastify/jwt`（admin / user 两套密钥与 issuer）                 | Bearer token                              |
| 文档       | `@fastify/swagger` + `@scalar/fastify-api-reference`             | `/docs` 界面                              |
| 其它插件   | `@fastify/multipart`、`@fastify/websocket`、`svg-captcha-fixed`  | 上传、WebSocket、图形验证码               |
| 日志       | Pino 10 + `pino-abstract-transport`（自定义按天切分）            | 结构化访问日志                            |
| 构建工具链 | `tsc` + `tsc-alias`（**锁 1.9.1**）+ `tsx`                       | 编译、改写 `@/` 别名、dev 直跑 TS         |
| 代码规范   | Prettier（`printWidth 120`、LF、2 空格）+ `.githooks/pre-commit` | 在仓库根执行 `pnpm format` / `pnpm check` |

---

## 四、怎么打包（构建）与部署

### 4.1 开发

```bash
# 仓库根。首次需要 .env
cp apps/services/.env.example apps/services/.env
pnpm dev:services                 # = turbo dev --filter=@repo/services
```

`dev` 脚本是 `node --env-file=.env --watch --import tsx src/server.ts`：`.env` 不存在会**直接启动失败**
（宁可起不来，也不要带着错配置跑）。启动后 API 在 `http://localhost:<PORT>`，文档在 `/docs`。

### 4.2 打包

```bash
pnpm build                        # 仓库根，turbo 会先按依赖顺序构建被依赖的仓库包
pnpm --filter @repo/services build   # 只打后端（要求 packages/*/dist 已存在）
```

`build` 执行 `tsx scripts/build.ts`，按顺序做 7 件事：

1. 清空 `dist/`（有目录名与越界校验，删错路径会直接抛错）；
2. `tsc -p tsconfig.json` 编译 `src/`；
3. `tsc-alias` 把 `@/xxx` 别名改写成产物内的相对路径，并补 `.js` 扩展名；
4. 删除所有 `.map`；
5. 生成 `dist/drizzle.config.mjs`（schema 指向编译后的 `db/*.js`，否则产物里没有 TS schema）；
6. vendor 所有 workspace 依赖：`dependencies` 里凡是 `workspace:*` / `link:…` / 指向仓库内的 `file:…`，
   自动把构建产物拷进 `dist/vendor/<slug>`（实现见 `scripts/workspace-vendor.ts`）；
7. 生成 `dist/package.json`：本地包写成 `file:./vendor/<slug>`，外部依赖固定成构建机实际安装的版本，
   并写好 `start` / `prestart` / `db:*` 脚本。

产物结构：

```
dist/
├── package.json          # 真实 dependencies + start / prestart / db:* 脚本
├── drizzle.config.mjs    # 部署侧 drizzle-kit push 用的配置
├── vendor/               # workspace 包的编译产物（npm 不认 workspace: 协议）
│   ├── shared/           #   @repo/shared → file:./vendor/shared
│   └── logger/           #   @repo/logger → file:./vendor/logger
├── server.js  app.js
└── core/ db/ modules/ permissions/ plugins/ types/ utils/
```

为什么要有 `vendor/`：编译产物里保留的是裸包名 `import { BusinessCode } from "@repo/shared"`，
而 `package.json` 里写的是 pnpm 专属的 `workspace:*`，npm 不认。所以 build 把包产物拷进
`dist/vendor/shared`，并把依赖声明成 `file:./vendor/shared`，`npm install` 时才会落到
`dist/node_modules/@repo/shared`。不能直接放进 `dist/node_modules/`——`npm ci` 会先删掉整个
`node_modules`，放里面必丢。

这套 vendor 逻辑不写死包名（`scripts/workspace-vendor.ts`）：

- 谁在 `dependencies` 里用 `workspace:*` / `link:` / 指向仓库内的 `file:`，谁就按本地包处理，
  `dist/vendor/` 下的目录名取「去掉 scope」后的名字（`@repo/shared` → `shared`）；
- 本地包再依赖本地包会递归处理；即使应用没有直接声明它，也会补进 `dist` 依赖——
  npm 安装 `file:` 依赖时不会递归装它的依赖，而 vendor 包是顺着 `node_modules` 往上找依赖的；
- vendor 出来的 `package.json` 按字段白名单重建：`exports` / `bin` / `files` / `engines` 等原样照抄，
  `scripts` / `devDependencies` 丢掉（服务器上 `npm install --omit=dev` 没有 tsc，`prepare` 会直接失败），
  `catalog:` 这类 npm 不认的协议换成构建机实际安装的版本；
- 拷贝范围按 npm pack 的规则来（`files` 字段，默认 `dist`），所以包里带 `bin/`、模板、静态资源也能一起进产物。

**新加一个仓库内包不用改 build.ts**：在应用的 `package.json` 里加一条 `"@repo/xxx": "workspace:*"`，
`pnpm install`（生成 workspace 软链）后 `pnpm build` 即可，turbo 的 `dependsOn: ["^build"]` 会先构建它。
唯一要保证的是那个包自己有构建产物（`dist/`），否则 build 会带着「先执行 pnpm build / pnpm --filter 构建」的提示报错。

### 4.3 运行与部署

```bash
# A. 在仓库里跑产物（依赖由 pnpm 装在 apps/services/）
pnpm start                        # 仓库根，= npm --prefix apps/services/dist start

# B. 把整个 dist/ 拷到服务器，只靠 npm
cd dist
npm install --omit=dev            # 有 lockfile 时用 npm ci --omit=dev
npm start                         # prestart：db:push + 权限码种子；然后 node --env-file-if-exists=.env server.js
```

部署要点：

- **只有 `dependencies` 上服务器**（`--omit=dev`）：`tsx` / `typescript` / `tsc-alias` 不装，
  所以 `dev`、`gen:module` 只能在仓库里跑。`drizzle-kit` 例外——它写在 `dependencies` 里，
  跟着 dist 装进去，部署侧才能跑 `db:push`。
- **`prestart` 自动同步表结构**：`npm run db:push && npm run db:seed:permissions`，失败则服务不启动。
  `db:seed:admin` 故意不在自动流程里——它带 `onConflictDoUpdate(password)`，自动跑等于每次发版重置管理员密码。
- **环境变量优先用平台注入**（systemd `EnvironmentFile=` / Docker `--env-file` / K8s Secret）。
  产物侧用的是 `--env-file-if-exists`，没有 `.env` 不会失败；要放文件就读**执行目录**下的 `dist/.env`。
- `pnpm build` 每次清空 `dist/`（含手工装进去的 `node_modules`），所以一份 dist 对应一个版本，
  升级就是「整目录替换 + 重装依赖」。
- 日志写到包根下的 `logs/`：`app.ts` 用 `import.meta.url` 反推包根，dist 单独部署时它自己就是包根，
  不会写到部署目录外面。
- 接口文档用 `API_DOCS_ENABLED` 控制，生产建议 `false`。
- 构建自检：`grep -r 'from "[^".]*index\.js"' apps/services/dist` 应为空（防止 `tsc-alias` 把裸包名补全成
  `zod/v4/index.js` 这类非导出子路径）。

### 4.4 数据库表结构同步

**只有一条命令：`db:push` = `drizzle-kit push`**，「schema ↔ 活库 diff 后直接执行 DDL」，
仓库里不生成、也不提交任何 SQL 迁移文件。

```bash
pnpm db:push                      # 仓库根；读 src/db/*.ts
# 部署侧（dist 目录内）
npm run db:push                   # 读编译后的 db/*.js；npm start 的 prestart 会自动跑
```

⚠️ push 是「以 schema 为准反向覆盖数据库」：库里多出来的列 / 表会被**直接删除**，没有回滚记录。
终端里删列会要求确认，**服务器上没有 TTY 时它不提问、直接执行**。生产变更建议先在开发库跑一遍。
多实例同时启动时 `db/script/push-db.ts` 会先取 Postgres advisory lock，把并发 DDL 串行化。

#### 想从零开始：手动删库

仓库不提供「一条命令清库」的入口：要回到全新状态就手动删库，再用 `pnpm db:push` 重建结构、跑两个种子
（表结构完全来自 `src/db/*.ts`）。

手动删库时如果报 `database "xxx" is being accessed by other users`，**不是因为服务没停**：
`DROP DATABASE` 只要还有任意一个别的会话连着就会被拒 —— Navicat 左侧连接树停在那个库上、
开着的查询窗口 / 对象页签、忘了退的 psql，都各算一个会话；客户端不断开，它们就一直挂着。
PG 13+ 直接 `DROP DATABASE xxx WITH (FORCE);` 让库自己 `pg_terminate_backend`；
13 以下先 `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'xxx' AND pid <> pg_backend_pid();`
再删 —— 这条路有极小的重连窗口，失败重跑即可。

### 4.5 命令速查

| 命令（仓库根）                           | 等价                                          | 说明                                           |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `pnpm dev:services`                      | `turbo dev --filter=@repo/services`           | 开发模式，`--watch` 热重启                     |
| `pnpm build`                             | `turbo build`                                 | 先构建被依赖的仓库包再构建本包                 |
| `pnpm --filter @repo/services typecheck` | `tsc --noEmit -p tsconfig.json`               | 只做 `src/` 类型检查                           |
| `pnpm start`                             | `npm --prefix apps/services/dist start`       | 跑 dist 里的 `start`（带 `prestart` 同步）     |
| `pnpm gen:module <name>`                 | `tsx scripts/gen_module.ts`                   | 生成 `<module>.route/schema/service.ts` 脚手架 |
| `pnpm db:push`                           | `tsx src/db/script/push-db.ts`                | 改完表结构就跑它                               |
| `pnpm db:push:dist`                      | `npm --prefix apps/services/dist run db:push` | 验证产物侧 push（需先注入 `APP_DATABASE_URL`） |
| `pnpm db:seed:admin`                     | `tsx src/db/script/admin-user.ts`             | 初始化管理员账号（首次上线手动跑）             |
| `pnpm db:seed:permissions`               | `tsx src/db/script/permissions.ts`            | 同步权限码种子                                 |

`db:*` / `gen:module` 故意不进 turbo：它们是一次性、有副作用或部署期命令，走缓存只会白白算 hash。

---

## 五、环境变量

`--env-file` 加载，不依赖 dotenv。**只有一份 `.env`**（不入库，开发/部署共用，值按环境填），模板是 `.env.example`。

| 变量                                   | 默认值             | 说明                                              |
| -------------------------------------- | ------------------ | ------------------------------------------------- |
| `PORT` / `HOST`                        | `3000` / `0.0.0.0` | 监听地址                                          |
| `TRUST_PROXY`                          | `false`            | 在 Nginx 等反代后面时设 `true`，否则拿不到真实 IP |
| `BODY_LIMIT`                           | `1048576`          | 请求体上限（字节）                                |
| `LOG_DIR` / `LOG_LEVEL`                | `logs` / `info`    | 日志目录与级别                                    |
| `API_DOCS_ENABLED`                     | `true`             | 是否开放 `/docs`                                  |
| `APP_DATABASE_URL`                     | 必填               | PostgreSQL 连接串                                 |
| `REDIS_URL` / `REDIS_PREFIX`           | 必填 / `PREFIX:`   | Redis 连接串与 key 前缀                           |
| `ADMIN_JWT_SECRET` / `USER_JWT_SECRET` | 必填               | 两套 JWT 密钥                                     |
| `ACCESS_TOKEN_TTL`                     | `7d`               | token 过期时间                                    |
| `UPLOAD_MAX_FILE_SIZE`                 | `10485760`         | 上传大小上限（字节）                              |

两个高频坑：

- `.env` 必须是 **UTF-8 无 BOM**，否则 `--env-file` 会丢掉第一个变量。
- `--env-file` **不会覆盖已存在的环境变量**。机器上有同名变量（比如别处导出的 `DATABASE_URL`）会静默顶掉配置，
  所以数据库变量特意命名为 `APP_DATABASE_URL`，启动日志里也会打印实际连上的库名。

---

## 六、认证与权限

两套独立 JWT 由**同一个插件** `plugins/jwt.ts` 管理：注册时按 `REALMS` 表把两套密钥和 issuer 各注册成一个
`@fastify/jwt` 命名空间（`fastify.jwt.admin` / `fastify.jwt.user`），请求时只跑一个 `preHandler`，
按路由声明的 `config.auth` 选命名空间，**与 URL 前缀无关**：

```ts
// 管理端：admin 命名空间（额外校验管理员状态 + permission）
config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_GET } satisfies RouteAuthConfig

// 用户端：user 命名空间
config: { auth: "user" } satisfies RouteAuthConfig

// 公开接口：钩子直接放行
config: { auth: "public" } satisfies RouteAuthConfig
```

- **未声明 `config.auth`（或整个 `config`）等同公开**——需要鉴权的接口必须显式声明。
- 新增一套身份只改两处：`plugins/jwt.ts` 的 `REALMS` 表（一行）和 `types/auth.ts` 的 `JwtRealm`，
  注册、类型、启动期校验一起生效。
- issuer 写死在 `REALMS` 表里（`admin` → `admin-system`，`user` → `user-system`），不开放环境变量配置；
  两个 issuer 不同，所以 admin 签发的 token 拿不到 user 接口上，反之亦然。
- `config.auth` 在**启动阶段**校验（`onRoute` 钩子）：取值拼错、或把 `permission` 配在非 `admin` 路由上，
  服务直接启动失败，不会等请求进来才暴露。
- 校验顺序：验签（签名 / issuer / 有效期）→ Redis 会话 → 快照里的账号状态 →（仅 admin）回查库中状态
  →（仅 admin 且声明了 `permission`）权限联查。
- `permission` 只存在于 `auth: "admin"` 分支（`RouteAuthConfig` 是判别联合）；
  `auth: "user"` / `"public"` 带 `permission` 会在编译期报错。
- `src/permissions/` 的常量只服务本包：① 路由声明期的编译期 typo 检查；② `db:seed:permissions` 同步 `code` 表。
  **运行时权限以数据库为准**；前端通过 `/code` 系列接口读表，不要 import 这里的常量。

---

## 七、日志

日志由 `@repo/logger`（`packages/logger`）负责，**pino 已移除**。设计文档见 `packages/logger/DESIGN.md`
（第 19 节是最终实现），这里只讲运维视角。

### 7.1 文件布局

```
<包根>/logs/
├── router/2026-10-23.log     # 请求日志（method/url/ip/headers/query/params/body/files）
└── log/2026-10-23.log        # 应用日志（error-handler / 业务 fastify.log）
```

设置了 `LOG_SERVICE` 时多一层：`logs/<service>/router|log/…`（多服务共用一个 `LOG_DIR` 时用）。

- 一行一条 JSON，字段顺序 `level` / `time` / `ts` / `service?` / `pid` / … / `msg`
- 跨天**自动切换**（每条按自己的 `ts` 决定落哪个文件），服务长期运行不用重启
- 单文件超 `LOG_MAX_FILE_MB`（默认 10MB）切 `2026-10-23.1.log`
- 超 `LOG_RETENTION_DAYS`（默认 30 日历日）的文件由子进程每小时清理一次，启动也清一次

### 7.2 记什么 / 不记什么

| 内容                                           | 记不记                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| method / url / ip / requestId / query / params | ✅                                                                         |
| 请求头（全量，含 `authorization` / `cookie`）  | ✅ 进管道后由**子进程**脱敏成 `[Redacted]`                                 |
| JSON body 的字段                               | ✅（单字段 >16KB 或整个 body >2000 节点时记摘要）                          |
| multipart 的文本字段                           | ✅ 放 `body`                                                               |
| 上传文件的**元信息**                           | ✅ 放 `files`：`fieldname / filename / mimetype / encoding / bytes`        |
| 上传文件的**内容**                             | ❌ 流式丢弃，不进内存、不进日志                                            |
| 报错信息                                       | ✅（`err` 展开 name/message/stack/code；解析失败的请求额外带 `bodyError`） |

### 7.3 子进程

- 默认 `LOG_MODE=child`：主服务 spawn 一个子进程专门写盘，随主服务启动/关闭
- 子进程异常退出会退避重启（200ms→5s 封顶），**不降级**；期间日志进有界队列，溢出即丢（`dropped` 计数）
- 磁盘满：子进程不退出、不堵管道，只丢数据并在 stderr 报 `ENOSPC`
- 主进程被强杀：子进程靠 stdin EOF 自己退出，不留孤儿

### 7.4 查看

```bash
# 打包产物/依赖装好后，白得一个命令（bin: repo-log）
npx repo-log tail --dir logs --type router --follow
npx repo-log tail --dir logs --type log --lines 100 --level warn --grep 登录
npx repo-log cat --dir logs --type router --date 2026-10-23 --limit 200
npx repo-log ls --dir logs
```

也可以直接用 `Get-Content -Wait` / `tail -f` 读文件，格式就是 NDJSON。

### 7.5 配置

`LOG_*` 由 `@repo/logger` 解析，**不在 `core/env.ts` 的 zod schema 里**（非法值回落默认）：
`LOG_SERVICE`、`LOG_DIR`、`LOG_LEVEL`、`LOG_MODE`（child/off）、`LOG_RETENTION_DAYS`、`LOG_MAX_FILE_MB`、
`LOG_BODY_MAX_BYTES`、`LOG_BODY_MAX_NODES`、`LOG_REDACT_PATHS`、`LOG_REDACT_CENSOR`、
`LOG_SINK_MAX_BUFFER_MB`、`LOG_STDOUT`。完整清单见 `packages/logger/DESIGN.md` §19.4。

> ⚠️ `.env` 里**不要用 `//` 注释**：Node 的 `--env-file` 只认 `#`，`REDIS_URL=redis://… // 说明`
> 会把注释一起当成值，ioredis 会抛 `Invalid URL`。

---

## 八、约定与已知坑

1. **共享代码边界**：`packages/shared` 不允许依赖 `fastify`；Fastify 的类型增强只能留在 `src/types/fastify.d.ts`。
2. **`@/*` 别名只属于本包**，定义在 `apps/services/tsconfig.json`，不要提到根 `tsconfig.base.json`。
3. **`tsc-alias` 必须锁 `1.9.1`（精确版本，不要加 `^`）**：1.9.2+ 的 `--resolve-full-paths` 会把裸包名补全成
   `zod/v4/index.js`、`drizzle-orm/pg-core/index.js`，这些子路径不在对方 `exports` 里，产物会以
   `ERR_PACKAGE_PATH_NOT_EXPORTED` 启动失败。
4. **`typescript` 不能提到仓库根**：`scripts/build.ts` 硬编码了 `apps/services/node_modules/.bin/tsc`，
   提到根会让 `pnpm build` 直接 ENOENT。
5. **改完 `packages/shared` 要重新 build**：单独跑后端前先 `pnpm --filter @repo/shared build`，
   否则会报 `ERR_MODULE_NOT_FOUND: @repo/shared`。
6. **所有相对路径以包目录为基准**（`pnpm --filter` 会把 CWD 切到 `apps/services`）。
   不要在仓库根直接 `node apps/services/src/server.ts`——`--env-file` 与 `@/*` 别名都会失效。
7. **新增模块**：`pnpm gen:module <name>`，保持 `<module>.route|schema|service.ts` 三件套；
   新增插件放到 `src/plugins/xxx.ts`，插件名与文件名一致。
8. **改表结构**：改 `src/db/*.ts` → `pnpm db:push`；想让任务按依赖顺序跑，就往 `turbo.json` 的 `tasks` 里加。

---

## 九、接口文档

启动后访问 `/docs`（Scalar UI，OpenAPI 3.0.3），Bearer 认证在页面右上角填入。
文档由各路由 `<module>.schema.ts` 里的 zod schema 自动生成，**新接口必须带 schema**，否则不会出现在文档里。
