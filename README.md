# Fastify Server

一个基于 Fastify + TypeScript 的现代化 Node.js 后端服务，提供 RESTful API、数据库管理和身份认证功能。

## 🚀 技术栈

- **框架**: [Fastify](https://www.fastify.io/) 5.x
- **语言**: [TypeScript](https://www.typescriptlang.org/) 6.x
- **数据库**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **缓存**: Redis
- **认证**: JWT（Admin / User 两套独立密钥）
- **验证**: [Zod](https://zod.dev/)
- **文档**: Swagger + Scalar
- **日志**: Pino
- **包管理**: npm
- **代码质量**: Prettier + TypeScript 严格模式（`npm run check`）

## 📋 项目结构

```
src/
├── server.ts                  # 进程入口：启动兜底 / 优雅停机 / 退出前 flush 日志
├── app.ts                     # 应用装配：logger、bodyLimit、trustProxy、autoload
├── core/
│   ├── env.ts                 # 环境变量校验（失败时输出可读原因）
│   ├── app-error.ts           # BusinessCode / AppError / describeError
│   ├── error-handler.ts       # 统一错误处理（保留 HTTP 语义）
│   ├── response.ts            # reply.success / reply.error / x-request-id
│   ├── jwt-guard.ts           # JWT 鉴权 + 权限校验工厂
│   └── access-log-transport.mjs # 按天切分日志的自定义 pino transport
├── db/                        # Drizzle 表结构（含索引定义）
├── modules/<module>/          # 业务模块：<module>.route|schema|service.ts
├── permissions/               # 权限码常量与种子数据
├── plugins/                   # Fastify 插件（jwt / logger / postgres / redis / swagger ...）
├── types/                     # 类型声明与 Fastify 类型增强
└── utils/                     # 分页器、密码哈希、响应 schema、时间格式化
```

## 🔧 安装与配置

### 前置要求

- Node.js >= 25（使用内置 `--env-file` / `--watch`，无需 dotenv）
- PostgreSQL >= 14
- Redis >= 6.x

### 安装依赖

```bash
npm install
```

### 环境变量配置

环境文件通过 Node 原生 `--env-file` 加载（见 `package.json` 的脚本），不依赖任何 dotenv 包：

```bash
node --env-file=.env.dev src/server.ts
```

`.env.dev` / `.env.prod` **不入库**，请从模板复制：

```bash
cp .env.example .env.dev
```

关键配置项：

```env
# 服务器
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=false          # 部署在 Nginx 等反代后面时设为 true
BODY_LIMIT=1048576         # 请求体大小上限（字节）

# 数据库 / 缓存
APP_DATABASE_URL=postgres://user:password@localhost:5432/server_demo
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=your-app:

# 认证
ADMIN_JWT_SECRET=your-admin-secret
USER_JWT_SECRET=your-user-secret
JWT_ISSUER_ADMIN=admin-system
JWT_ISSUER_USER=user-system
ACCESS_TOKEN_TTL=7d

# 日志
LOG_DIR=logs
LOG_LEVEL=info

# 接口文档（生产建议 false）
API_DOCS_ENABLED=true

# 上传
UPLOAD_MAX_FILE_SIZE=10485760  # 10MB
```

> 注意：`--env-file` 不识别 UTF-8 BOM，env 文件请保存为「UTF-8 无 BOM」，否则第一个变量会丢失。
>
> 注意：`--env-file` **不会覆盖已存在的环境变量**。如果机器上已有同名变量（例如别的项目导出的 `DATABASE_URL`），它会静默顶掉本项目的配置——所以数据库连接变量命名为 `APP_DATABASE_URL`，启动日志里也会打印实际连上的库名，便于核对。

## 📦 npm 脚本

| 命令                              | 描述                                                |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | 开发模式（`--env-file=.env.dev`，`--watch` 热重启） |
| `npm run dev:prod`                | 用生产配置启动开发模式                              |
| `npm run build`                   | 编译 TypeScript 到 `dist/`                          |
| `npm start`                       | 启动生产服务器（`dist/server.js`）                  |
| `npm run typecheck`               | 对 `src/` 做类型检查                                |
| `npm run format` / `format:check` | Prettier 格式化 / 校验                              |
| `npm run check`                   | 格式 + 类型 一次性校验                              |
| `npm run gen:module <name>`       | 生成模块脚手架                                      |
| `npm run db:push:dev` / `:prod`   | 推送表结构到数据库                                  |
| `npm run db:seed:admin:dev`       | 初始化管理员账号                                    |
| `npm run db:seed:permissions:*`   | 同步权限码种子数据                                  |
| `npm run prepare:hooks`           | 启用仓库内置 Git hooks                              |

## 🚀 快速开始

### 开发模式

```bash
cp .env.example .env.dev   # 首次
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 生产构建

```bash
npm run build
npm start
```

### 数据库迁移

初次使用时，推送数据库架构：

```bash
npm run db:push:dev
```

## 📚 API 文档

启动服务后访问：

- **API 文档**: `http://localhost:3000/docs`

`/docs` 由 `API_DOCS_ENABLED` 控制，生产环境默认关闭（`.env.prod` 中为 `false`）。

## 🔐 认证系统

两套独立的 JWT 校验器，各自拥有独立的密钥（`ADMIN_JWT_SECRET` / `USER_JWT_SECRET`）与 issuer。

**由哪个校验器接管，完全取决于路由的 `config.auth`，与 URL 前缀无关**：

```ts
// 管理端：admin 校验器（额外校验管理员状态 + permission）
config: { auth: "admin", permission: PERMISSIONS.SYSTEM_USER_GET } satisfies RouteAuthConfig

// 用户端：user 校验器
config: { auth: "user" } satisfies RouteAuthConfig

// 公开接口：两套校验器都跳过
config: { auth: "public" } satisfies RouteAuthConfig
```

- 两个校验器都只注册了全局 `preHandler`，命中判断是 `config.auth === 自己的 realm`，不匹配直接放行、零额外开销。
- **未声明 `config.auth`（或整个 `config`）时等同于公开**，两套校验器都跳过——需要鉴权的接口务必显式声明。
- `permission` 只存在于 `auth: "admin"` 分支（`RouteAuthConfig` 是判别联合），`auth: "user"` / `"public"` 带 `permission` 会在编译期报错。

## 📝 代码规范

- **Prettier**：`printWidth 120`、LF、2 空格（见 `.prettierrc.json` / `.editorconfig`）
- **TypeScript**：`strict` + `verbatimModuleSyntax`，`npm run typecheck` 做 `src/` 的类型检查
- **导入路径约定**：`src/` 内部同目录兄弟文件用相对路径（`./user.schema`），跨目录用别名（`@/core/env`、`@/db/code`）；`scripts/` 不在 `src` 别名与类型检查范围内，统一用相对路径指向 `src`（如 `../src/db/code`）
- **Git hooks**：`.githooks/pre-commit` 只格式化暂存文件并补一次类型检查

一键校验：

```bash
npm run check
```

## 🔌 核心插件

| 插件                            | 功能              |
| ------------------------------- | ----------------- |
| `@fastify/jwt`                  | JWT 认证          |
| `@fastify/redis`                | Redis 集成        |
| `@fastify/swagger`              | Swagger 文档      |
| `@scalar/fastify-api-reference` | API 参考文档      |
| `@fastify/multipart`            | 文件上传处理      |
| `@fastify/websocket`            | WebSocket 支持    |
| `@fastify/autoload`             | 自动加载路由/插件 |

## 📊 日志

- 访问日志写入 `LOG_DIR`（默认 `logs/`），按天切分：`logs/router/YYYY-MM-DD.log`、`logs/log/YYYY-MM-DD.log`
- `LOG_LEVEL` 控制级别；请求体 / 查询 / 响应体按原样落盘（不再做超长截断与文件流过滤）
- 敏感字段（`authorization`、`cookie`、`set-cookie`、`password`、`token`）默认脱敏
- 进程收到 `SIGINT` / `SIGTERM` 时会先 `app.close()` 并 flush 日志再退出

## 🛠️ 开发建议

1. **添加新模块**：`npm run gen:module <name>`，遵循 `<module>.route|schema|service.ts` 结构
2. **添加数据库表**：在 `src/db/` 下新建文件定义表结构（含索引），再执行 `npm run db:push:dev`
3. **添加插件**：在 `src/plugins/` 下新建 `xxx.ts`，插件名与文件名保持一致

## 📄 许可证

ISC
