# Monorepo

pnpm workspace 管理的前后端一体仓库：一个 `apps/services`（Fastify 服务）+ `packages/shared`（前后端共用契约），`apps/admin`（可配置的 Vue 3 管理后台模板，登录已接入）。

## 目录结构

```
.
├── apps/
│   ├── services/            # Fastify 5 + TypeScript 后端（原 fastify_server 全量迁移）
│   │   ├── src/
│   │   ├── scripts/         # build / gen_module（db 的种子/push 脚本在 src/db/script，才编得进 dist）
│   │   ├── .env（不入库） .env.example
│   │   ├── tsconfig.json
│   │   └── README.md        # 后端详细文档（文中的 npm run 换成 pnpm --filter @repo/services run）
│   └── admin/               # Vue 3 + Vite + Element Plus 管理后台模板（登录已通，业务页只保留骨架与占位文字）
├── packages/
│   └── shared/              # @repo/shared：业务码 / 统一响应 schema（前端拦截器用）
├── docs/
│   └── MONOREPO_MIGRATION.md  # 本次迁移的完整手册（含坑位说明）
├── pnpm-workspace.yaml
├── turbo.json               # Turborepo 任务图与缓存策略
├── tsconfig.base.json       # 公共 compilerOptions（不含 paths）
└── package.json             # 只有脚本、prettier、turbo，不放业务依赖
```

## 快速开始

```bash
pnpm install                 # 会顺带执行 packages/shared 的 prepare（编译出 dist）

# 首次需要环境变量（只有一份 .env，开发和部署共用）
cp apps/services/.env.example apps/services/.env

pnpm dev                     # turbo 先构建依赖包，再并行起 shared --watch 和 services --watch
```

- API：http://localhost:3000（**端口以 `apps/services/.env` 的 `PORT` 为准**，模板里是 3000）
- 接口文档：http://localhost:3000/docs
- 管理后台：http://localhost:5173（`pnpm dev:admin`，已代理 `/admin`、`/api` 到上面的 API 端口）

## 常用命令

所有跨包编排都走 Turborepo（`turbo.json`），带依赖拓扑 + 增量缓存。

| 命令                                    | 等价 turbo 命令                     | 说明                                                                     |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                              | `turbo dev`                         | 同时起 shared 监听 + services 热重启                                     |
| `pnpm dev:services`                     | `turbo dev --filter=@repo/services` | 只起 services                                                            |
| `pnpm dev:admin`                        | `turbo dev --filter=@repo/admin`    | 只起 admin（Vite，5173）                                                 |
| `pnpm build`                            | `turbo build`                       | 按依赖顺序构建（shared 先，services 后）                                 |
| `pnpm typecheck`                        | `turbo typecheck`                   | 所有包的类型检查                                                         |
| `pnpm start`                            | —                                   | 进 `apps/services/dist` 跑 `npm start`（`prestart` 自动同步表结构）      |
| `pnpm check`                            | —                                   | Prettier 校验 + 类型检查                                                 |
| `pnpm format`                           | —                                   | 格式化整个仓库                                                           |
| `pnpm gen:module <name>`                | —                                   | 生成业务模块脚手架                                                       |
| `pnpm db:push`                          | —                                   | **改完表结构就跑它**：`drizzle-kit push`，schema 与库 diff 后执行 DDL    |
| `pnpm db:push:dist`                     | —                                   | 跑 `dist/` 里的同款 `db:push`（验证产物侧，需先注入 `APP_DATABASE_URL`） |
| `pnpm db:seed:admin`                    | —                                   | 初始化管理员账号                                                         |
| `pnpm db:seed:permissions`              | —                                   | 同步权限码种子                                                           |
| `pnpm prepare:hooks`                    | —                                   | 启用 `.githooks/pre-commit`                                              |
| `pnpm --filter @repo/services <script>` | —                                   | 在 services 包内跑任意脚本                                               |

> `db:*` / `gen:module` 故意留在 `pnpm --filter`：它们是一次性、有副作用或部署期的命令，
> 走 turbo 只会白白算 hash、还有被缓存「跳过」的风险。
>
> `start` 是唯一例外：它不定义在 services 包里，而是 `npm --prefix apps/services/dist start` ——
> 直接跑 `dist/package.json` 自己的脚本，这样 `prestart`（`db:push` + 权限码种子）才会生效。
>
> **表结构同步只有一条命令：`db:push` = `drizzle-kit push`。** 开发和生产用的是同一个机制
> （schema ↔ 活库 diff，然后直接执行 DDL），差别只有 schema 从哪儿读：仓库读 `src/db/*.ts`，
> 产物读编译后的 `db/*.js`（`dist/drizzle.config.mjs` 由 build 生成）。
> 仓库里**不生成、不提交任何 SQL 迁移文件**；drizzle-kit 因此写在 `dependencies` 里、会一起进 dist。
>
> **想清库重来只能手动删库**（仓库不提供删库命令）。手动删库时如果报
> `database "xxx" is being accessed by other users`，那不是服务没停：
> 只要还有**任意一个**会话连着（Navicat 的左侧连接树、开着的查询窗口/对象页签都各算一个），
> PostgreSQL 就会拒绝 `DROP DATABASE`。连接切到 `postgres` 库后执行
> `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'your_db' AND pid <> pg_backend_pid();`
> 再 `DROP DATABASE your_db;`（PG 13+ 也可以直接 `DROP DATABASE your_db WITH (FORCE);`），
> 之后用 `pnpm db:push` + `db:seed:permissions` + `db:seed:admin` 重建。
> 另外 `pnpm dev:services` 启动时已经带 `db:push` + `db:seed:permissions`，
> 只有管理员种子（`db:seed:admin`）需要单独跑。

### Turborepo 缓存

`turbo.json` 里只有 3 个任务：

```jsonc
{
  "globalDependencies": ["tsconfig.base.json"], // 改它 = 全量失效
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] }, // 依赖包要先 build 出 d.ts，否则 services 类型检查会挂
    "dev": { "cache": false, "persistent": true, "dependsOn": ["^build"] },
  },
}
```

- 第二次跑 `pnpm build` 没改任何源码时会直接命中缓存：`2 cached, 16ms >>> FULL TURBO`
- 命中缓存时 turbo 会把 `dist/**` 从缓存还原，不用重跑 tsc
- `dev` 是常驻任务，必须 `"cache": false` + `"persistent": true`，否则 turbo 会等它退出
- 新增一个「需要按依赖顺序跑」的任务，就往 `turbo.json` 的 `tasks` 里加一条，再在根 `package.json` 挂个 `turbo <任务名>`
- 本地缓存落在 `.turbo/`（已 gitignore），想强制重跑：`pnpm build --force` 或删掉 `.turbo/`

## 约定（重要）

1. **包命名**：`@repo/*`，`apps/*` 是可部署应用，`packages/*` 是被引用的库。
2. **共享代码边界**：`packages/shared` 不允许依赖 `fastify`。Fastify 的模块增强
   （`apps/services/src/types/fastify.d.ts`）必须留在 services 里。
3. **shared 的相对导入必须带 `.js` 后缀**（哪怕源码是 `.ts`）。它的 tsconfig 用
   `module: NodeNext`，产物要被 Node 原生 ESM 直接加载，Node 不给补扩展名。
4. **不要给 `@repo/shared` 配 tsconfig `paths`**。它是真实包，靠 `node_modules` 软链 +
   `package.json#exports` 解析。写成 paths 会让 `tsc-alias` 把 import 改写成指向包外
   源码的相对路径，`dist` 直接跑不起来。
5. **`@/*` 别名只属于 services**，定义在 `apps/services/tsconfig.json`，不要提到根 `tsconfig.base.json`。
6. **共享包改完要重新 build**：`pnpm dev` 已经带了 `tsc --watch`；单独跑别的东西前先
   `pnpm --filter @repo/shared build`，否则 services 会报 `ERR_MODULE_NOT_FOUND: @repo/shared`。

7. **`tsc-alias` 锁定在 `1.9.1`（精确版本，不要加 `^`）**。1.9.2+ 的 `--resolve-full-paths`
   会把裸包名也补全成 `zod/v4/index.js`、`drizzle-orm/pg-core/index.js`，这些子路径不在对方的 `exports`
   里，产物会以 `ERR_PACKAGE_PATH_NOT_EXPORTED` 启动失败。构建后自检：
   `grep -r 'from "[^".]*index\.js"' apps/services/dist` 应为空。
8. **权限码不进 `packages/shared`**。`apps/services/src/permissions/` 的常量只服务 services 自己 —— 路由声明期的
   `config.auth.permission`（配合 `PermissionCode` 做编译期 typo 检查）和 `db:seed:permissions` 种子同步。
   前端一律通过 `/code` 系列接口读 `code` 表拿权限码，不要在 admin 里 import 常量；
   接口 schema 里也不要用 `z.enum(PERMISSION_CODES)` 当白名单，否则库里新增的码会被 zod 提前拦掉。
9. **多个包依赖同一个包时用 `catalog:` 锁版本，不要把依赖提到根 `package.json`**。版本定义在
   `pnpm-workspace.yaml` 的 `catalog:`，包内写 `"typescript": "catalog:"`。声明仍然留在各自包里，
   各自的 `node_modules/.bin` 才齐全 —— `apps/services/scripts/build.ts` 硬编码了
   `apps/services/node_modules/.bin/tsc.cmd`，把 typescript 提到根会让 `pnpm build` 直接 ENOENT。
   另外 pnpm 对相同版本只存一份物理拷贝，两个包的 `node_modules` 是指向同一目录的 junction，
   "提到根"并不能省下载。运行时依赖（如 `zod`）更不能提根，那会变成 phantom dependency。

   判断标准是**调用方在根还是在包内**：根 `devDependencies` 只放「被根脚本或全仓共用配置调用」的工具
   （现在有 `prettier` 和 `turbo`，以后 `eslint` / `vitest` 这类）；被某个包自己的 script 调用的工具（`tsx`、
   `tsc-alias`、各包的 `typescript`）留在该包，版本要统一就加进 `catalog:`，不要提根。

10. **跨包编排走 turbo，别手写 `pnpm -r` / `pnpm --filter` 串流程**。需要按依赖顺序执行的任务写进
    `turbo.json` 的 `tasks`（带 `dependsOn: ["^build"]`），根 `package.json` 只做 `turbo <任务名>` 转发。
    一次性 / 有副作用 / 部署期的命令（`db:*`、`gen:module`）留在 `pnpm --filter`；`start` 则直接进 `dist/` 跑 dist 自己的脚本。都不进 turbo。
    改了某个包的 `outputs` 目录记得同步 `turbo.json` 的 `outputs`，否则缓存命中时产物不会被还原。

## 运行时路径说明

`apps/services` 里所有相对路径都以**包目录**为基准（`pnpm --filter` 会把 CWD 切到 `apps/services`）：

- 环境变量：只有一份 `apps/services/.env`（不入库，开发/部署共用，`.env.example` 是模板）；`pnpm start` 是在 `dist/` 里执行的，读的是 `apps/services/dist/.env`
- 日志：`apps/services/logs/`（`app.ts` 用 `import.meta.url` 反推包根，dev 和 dist 两种运行方式都对）
- 构建产物：`apps/services/dist/`

所以不要在仓库根直接 `node apps/services/src/server.ts` —— 那样 `--env-file` 和 `@/*` 别名都会失效。
