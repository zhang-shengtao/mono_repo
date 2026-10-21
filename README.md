# Fastify Server

一个基于 Fastify + TypeScript 的现代化 Node.js 后端服务，提供 RESTful API、数据库管理和身份认证功能。

## 🚀 技术栈

- **框架**: [Fastify](https://www.fastify.io/) 5.x
- **语言**: [TypeScript](https://www.typescriptlang.org/) 6.x
- **数据库**: MySQL + [Drizzle ORM](https://orm.drizzle.team/)
- **缓存**: Redis
- **认证**: JWT (Admin & User 分离)
- **验证**: [Zod](https://zod.dev/)
- **文档**: Swagger + Scalar
- **日志**: Pino
- **包管理**: npm

## 📋 项目结构

```
src/
├── server.ts              # 服务器入口
├── app.ts                 # 应用初始化
├── config/
│   └── env.ts            # 环境变量配置
├── common/
│   └── app-error.ts      # 自定义错误类
├── db/
│   ├── admin-menus.ts    # 管理菜单数据模型
│   └── permissions.ts    # 权限数据模型
├── modules/              # 业务模块
│   ├── auth/            # 认证模块
│   │   ├── auth.route.ts
│   │   ├── auth.schema.ts
│   │   └── auth.service.ts
│   └── global/          # 全局模块
├── plugins/             # Fastify 插件
│   ├── jwt-admin.ts
│   ├── jwt-user.ts
│   ├── logger.ts
│   ├── mysql.ts
│   ├── redis.ts
│   └── swagger.ts
└── permissions/         # 权限管理
```

## 🔧 安装与配置

### 前置要求

- Node.js >= 18.x
- MySQL >= 5.7
- Redis >= 6.x

### 安装依赖

```bash
npm install
```

### 环境变量配置

复制环境配置文件模板：

- **开发环境**: `.env.dev`
- **生产环境**: `.env.prod`

关键配置项：

```env
# 服务器配置
PORT=3000
HOST=0.0.0.0

# 数据库
MYSQL_URL=mysql://user:password@localhost:3306/database

# 缓存
REDIS_URL=redis://127.0.0.1:6379

# 认证
ADMIN_JWT_SECRET=your-admin-secret
USER_JWT_SECRET=your-user-secret
JWT_ISSUER_ADMIN=admin-system
JWT_ISSUER_USER=user-system
ACCESS_TOKEN_TTL=7d

# 日志
LOG_DIR=logs
LOG_LARGE_REQUEST_PAYLOAD=false
LOG_LARGE_RESPONSE_PAYLOAD=false

# 上传
UPLOAD_MAX_FILE_SIZE=10485760  # 10MB
```

## 📦 npm 脚本

| 命令                       | 描述                                   |
| -------------------------- | -------------------------------------- |
| `npm run dev`              | 开发模式 (使用 .env.dev)               |
| `npm run dev:prod`         | 生产环境开发模式 (使用 .env.prod)      |
| `npm run build`            | 编译 TypeScript 到 JavaScript          |
| `npm start`                | 启动生产服务器                         |
| `npm run format`           | 使用 Prettier 格式化代码               |
| `npm run db:push:dev`      | 推送数据库迁移 (开发)                  |
| `npm run db:push:prod`     | 推送数据库迁移 (生产)                  |
| `npm run prepare:hooks`    | 配置 Git hooks                         |
| `db:push:dev`              | 推送数据库表结构使用.env.dev 做配置    |
| `db:push:prod`             | 推送数据库表结构使用.env.prod 做配置   |
| `db:seed:permissions:dev`  | 推送权限标识数据 使用 .env.dev 做配置  |
| `db:seed:permissions:prod` | 推送权限标识数据 使用 .env.prod 做配置 |

## 🚀 快速开始

### 开发模式

```bash
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

启动服务后，可以访问以下地址：

- **API 文档**: `http://localhost:3000/api/documentation`
- **Swagger UI**: `http://localhost:3000/api/swagger`

## 🔐 认证系统

项目支持两套独立的 JWT 认证系统：

- **Admin JWT**: 用于管理后台认证
- **User JWT**: 用于用户端认证

各自拥有独立的密钥 (`ADMIN_JWT_SECRET` 和 `USER_JWT_SECRET`) 和 issuer 标识。

## 📝 代码规范

- 使用 Prettier 进行代码格式化
- 配置了 Git pre-commit hooks
- TypeScript 严格模式启用

运行格式化：

```bash
npm run format
```

## 🔌 核心插件

| 插件                            | 功能              |
| ------------------------------- | ----------------- |
| `@fastify/jwt`                  | JWT 认证          |
| `@fastify/redis`                | Redis 集成        |
| `@fastify/swagger`              | Swagger 文档      |
| `@scalar/fastify-api-reference` | API 参考文档      |
| `@fastify/multipart`            | 文件上传处理      |
| `@fastify/autoload`             | 自动加载路由/插件 |

## 📊 日志

- 访问日志存储在 `logs/` 目录，按日期分文件 (`YYYY-MM-DD.log`)
- 大请求/响应体可选择记录到临时目录
- 使用 Pino 进行日志记录

## 🛠️ 开发建议

1. **添加新模块**: 在 `src/modules/` 下创建新目录，遵循 route/schema/service 的结构
2. **添加数据库表**: 在 `src/db/` 下创建新文件定义表结构
3. **添加插件**: 在 `src/plugins/` 下创建插件文件

## 📄 许可证

ISC
