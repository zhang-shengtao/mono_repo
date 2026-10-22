# Fastify Core Plugins 中文速查

来源：[Fastify 中文生态页 Core Plugins](https://www.fastify.cn/ecosystem/) 中插件名称上的文档链接。更新时间：2026-06-05。

说明：

- 本文覆盖生态页当前列出的 61 个 Core Plugins。
- 示例默认已有 `fastify` 实例，写法偏向当前项目的 ESM/TypeScript 风格。
- 未安装的插件示例仅作参考；实际使用前需要先安装对应包，并确认插件大版本和 Fastify 大版本匹配。
- 涉及认证、Cookie、Session、上传、代理、限流、CORS 的插件，生产环境必须按业务安全要求补齐密钥、白名单、大小限制和 HTTPS 配置。

## 1. @fastify/accepts

文档：https://github.com/fastify/fastify-accepts

作用：把 `accepts` 能力挂到 `request` 上，方便按 `Accept`、语言、编码、字符集等请求头做内容协商。

注意点：它只负责解析和协商，不会自动替你序列化响应；如果要按 `Accept` 自动选择序列化格式，通常看 `@fastify/accepts-serializer`。

示例：

```ts
import accepts from "@fastify/accepts";

await fastify.register(accepts);

fastify.get("/format", async (request, reply) => {
  const type = request.accepts().type(["json", "html"]);
  if (type === "html") return reply.type("text/html").send("<b>ok</b>");
  return reply.send({ ok: true });
});
```

## 2. @fastify/accepts-serializer

文档：https://github.com/fastify/fastify-accepts-serializer

作用：根据请求 `Accept` 头选择响应序列化器，例如 YAML、MessagePack、Protobuf 等。

注意点：没有匹配的 serializer 且没有设置 `default` 时会返回 406；`application/json` 默认仍由 Fastify 处理。

示例：

```ts
import acceptsSerializer from "@fastify/accepts-serializer";
import YAML from "yamljs";

await fastify.register(acceptsSerializer, {
  serializers: [{ regex: /^application\/yaml$/, serializer: (body) => YAML.stringify(body) }],
  default: "application/yaml",
});

fastify.get("/data", async () => ({ hello: "world" }));
```

## 3. @fastify/auth

文档：https://github.com/fastify/fastify-auth

作用：组合多个认证函数，用 `or` 或 `and` 关系保护路由。

注意点：它不提供 JWT、Basic Auth 等具体策略，只负责组合你自己提供的认证函数。认证函数如果是 `async`，不要再调用 `done`，否则可能重复进入 handler。只读 Header 的认证建议尽量放在较早的生命周期，避免未授权请求先解析大 body。

示例：

```ts
import auth from "@fastify/auth";

fastify.decorate("verifyApiKey", async (request) => {
  if (request.headers["x-api-key"] !== process.env.API_KEY) throw new Error("unauthorized");
});

await fastify.register(auth);

fastify.get(
  "/admin",
  {
    preHandler: fastify.auth([fastify.verifyApiKey]),
  },
  async () => ({ ok: true }),
);
```

## 4. @fastify/autoload

文档：https://github.com/fastify/fastify-autoload

作用：自动加载目录里的插件、路由或服务模块，适合按目录拆分大型项目。

注意点：要关注加载顺序和封装作用域；公共插件应在路由 autoload 之前注册。ESM 项目里需要自己用 `import.meta.url` 算目录。

示例：

```ts
import autoload from "@fastify/autoload";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
await fastify.register(autoload, { dir: join(root, "routes") });
```

## 5. @fastify/awilix

文档：https://github.com/fastify/fastify-awilix

作用：基于 Awilix 给 Fastify 提供依赖注入容器，支持应用级容器和请求级 scope。

注意点：需要同时理解 Awilix 的生命周期。请求级依赖建议用 `disposeOnResponse` 释放，数据库连接等长生命周期资源不要误设为每请求创建。

示例：

```ts
import { fastifyAwilixPlugin, diContainer } from "@fastify/awilix";
import { asValue } from "awilix";

await fastify.register(fastifyAwilixPlugin, { disposeOnClose: true });

diContainer.register({
  config: asValue({ serviceName: "api" }),
});

fastify.get("/di", async (request) => {
  return request.diScope.resolve("config");
});
```

## 6. @fastify/aws-lambda

文档：https://github.com/fastify/aws-lambda-fastify

作用：把 Fastify 应用包装成 AWS Lambda/API Gateway 可调用的 handler。

注意点：它不是普通 `fastify.register()` 插件，而是 Lambda 适配器。冷启动场景下应在模块顶层创建并复用 Fastify 实例，避免每次请求都重新初始化。

示例：

```ts
import awsLambdaFastify from "@fastify/aws-lambda";

fastify.get("/health", async () => ({ ok: true }));

export const handler = awsLambdaFastify(fastify);
```

## 7. @fastify/basic-auth

文档：https://github.com/fastify/fastify-basic-auth

作用：提供 HTTP Basic Authentication 支持。

注意点：Basic Auth 凭证会随请求发送，生产环境必须配合 HTTPS；校验函数里不要记录明文密码。

示例：

```ts
import basicAuth from "@fastify/basic-auth";

await fastify.register(basicAuth, {
  validate: async (username, password) => {
    if (username !== "admin" || password !== process.env.ADMIN_PASSWORD) {
      throw new Error("invalid credentials");
    }
  },
});

fastify.get("/private", { onRequest: fastify.basicAuth }, async () => ({ ok: true }));
```

## 8. @fastify/bearer-auth

文档：https://github.com/fastify/fastify-bearer-auth

作用：提供 Bearer Token 认证支持，常用于简单 API token 场景。

注意点：token 应使用高熵随机值并从环境变量或密钥系统读取；如果有用户身份、过期时间、刷新机制，通常更适合用 JWT 或 OAuth2。

示例：

```ts
import bearerAuth from "@fastify/bearer-auth";

await fastify.register(bearerAuth, {
  keys: new Set([process.env.API_TOKEN!]),
});

fastify.get("/token-only", async () => ({ ok: true }));
```

## 9. @fastify/caching

文档：https://github.com/fastify/fastify-caching

作用：提供服务端缓存对象、Cache-Control、Expires、ETag 等 HTTP 缓存辅助能力。

注意点：默认内存缓存不适合生产环境共享状态；多实例部署应接入 Redis 等外部缓存。

示例：

```ts
import caching from "@fastify/caching";

await fastify.register(caching, {
  privacy: caching.privacy.PUBLIC,
  expiresIn: 60,
});

fastify.get("/cached", async (request, reply) => {
  reply.etag("v1");
  return { ok: true };
});
```

## 10. @fastify/circuit-breaker

文档：https://github.com/fastify/fastify-circuit-breaker

作用：给路由增加熔断保护，在下游慢、失败率高或超时严重时快速失败。

注意点：熔断阈值必须按业务实际调，不应把所有错误都当作可熔断故障；还要区分客户端错误和下游错误。

示例：

```ts
import circuitBreaker from "@fastify/circuit-breaker";

await fastify.register(circuitBreaker, {
  threshold: 5,
  timeout: 3000,
  resetTimeout: 10000,
});

fastify.get("/remote", { circuitBreaker: true }, async () => {
  return { from: "upstream" };
});
```

## 11. @fastify/compress

文档：https://github.com/fastify/fastify-compress

作用：为响应提供 gzip、deflate、brotli 等压缩，也支持解压请求体。

注意点：小响应压缩收益有限，CPU 成本可能高于网络收益；流式响应和代理响应要确认压缩行为符合预期。

示例：

```ts
import compress from "@fastify/compress";

await fastify.register(compress, {
  global: true,
  threshold: 1024,
});

fastify.get("/large-json", async () => ({ items: Array.from({ length: 1000 }, (_, i) => i) }));
```

## 12. @fastify/cookie

文档：https://github.com/fastify/fastify-cookie

作用：解析请求 Cookie，并提供 `reply.setCookie()`、`reply.clearCookie()`、签名 Cookie 等能力。

注意点：插件默认在 `onRequest` 解析 Cookie，依赖 Cookie 的其他 `onRequest` hook 要放在它之后。签名密钥建议至少 20 字节，并配合 `httpOnly`、`secure`、`sameSite` 使用。

示例：

```ts
import cookie from "@fastify/cookie";

await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET,
});

fastify.get("/cookie", async (request, reply) => {
  reply.setCookie("sid", "123", { path: "/", httpOnly: true, signed: true });
  return { sid: request.cookies.sid };
});
```

## 13. @fastify/cors

文档：https://github.com/fastify/fastify-cors

作用：为 Fastify 应用启用 CORS 响应头和预检请求处理。

注意点：生产环境不要随手 `origin: true` 或 `origin: '*'` 搭配凭证请求；要明确允许的域名、方法和请求头。

示例：

```ts
import cors from "@fastify/cors";

await fastify.register(cors, {
  origin: ["https://admin.example.com"],
  credentials: true,
});
```

## 14. @fastify/csrf-protection

文档：https://github.com/fastify/csrf-protection

作用：提供 CSRF token 生成和校验工具，可结合 Cookie、`@fastify/session` 或 `@fastify/secure-session` 使用。

注意点：CSRF 防护不是只装插件就完成；要结合 SameSite Cookie、HTTPS、自定义 token 提取逻辑和业务表单流程。若 token 放在 body，校验 hook 不能放在 `onRequest`。

示例：

```ts
import cookie from "@fastify/cookie";
import csrf from "@fastify/csrf-protection";

await fastify.register(cookie, { secret: process.env.COOKIE_SECRET });
await fastify.register(csrf, { cookieOpts: { signed: true, httpOnly: true } });

fastify.get("/csrf-token", async (request, reply) => ({ token: await reply.generateCsrf() }));
fastify.post("/form", { onRequest: fastify.csrfProtection }, async (request) => request.body);
```

## 15. @fastify/elasticsearch

文档：https://github.com/fastify/fastify-elasticsearch

作用：在 Fastify 实例上共享 Elasticsearch client。

注意点：不要在每个请求里新建 ES client；需要配置连接、认证、TLS、重试和超时，并在关闭应用时释放资源。

示例：

```ts
import elasticsearch from "@fastify/elasticsearch";

await fastify.register(elasticsearch, {
  node: process.env.ELASTICSEARCH_URL,
});

fastify.get("/search", async function () {
  return this.elastic.search({ index: "logs", query: { match_all: {} } });
});
```

## 16. @fastify/env

文档：https://github.com/fastify/fastify-env

作用：按 JSON Schema 加载和校验环境变量或配置对象，并把结果挂到 Fastify 实例上。

注意点：配置 schema 要尽早注册，通常在数据库、Redis、JWT 等插件之前；不要把真实密钥提交到仓库。

示例：

```ts
import env from "@fastify/env";

await fastify.register(env, {
  schema: {
    type: "object",
    required: ["JWT_SECRET"],
    properties: {
      JWT_SECRET: { type: "string" },
    },
  },
  dotenv: true,
});

fastify.log.info(fastify.config.JWT_SECRET.length);
```

## 17. @fastify/etag

文档：https://github.com/fastify/fastify-etag

作用：自动为 HTTP 响应生成 ETag，帮助客户端和缓存层做条件请求。

注意点：动态、用户相关或包含时间戳的响应要确认 ETag 不会导致缓存误用；大响应计算 ETag 也有成本。

示例：

```ts
import etag from "@fastify/etag";

await fastify.register(etag);

fastify.get("/profile-template", async () => ({ version: 1 }));
```

## 18. @fastify/express

文档：https://github.com/fastify/fastify-express

作用：让 Fastify 可以使用部分 Express 中间件。

注意点：这是兼容层，不是性能优化手段。优先使用 Fastify 原生插件；Express 中间件的生命周期、错误处理和类型体验可能和 Fastify 不一致。

示例：

```ts
import expressPlugin from "@fastify/express";
import helmet from "helmet";

await fastify.register(expressPlugin);
fastify.use(helmet());
```

## 19. @fastify/flash

文档：https://github.com/fastify/fastify-flash

作用：基于 session 存取一次性 flash message，常用于登录后重定向提示。

注意点：必须先配置 session 相关插件；它适合服务端渲染页面，不适合纯 API 的长期消息存储。

示例：

```ts
import flash from "@fastify/flash";

await fastify.register(flash);

fastify.post("/login", async (request, reply) => {
  request.flash("info", "login success");
  return reply.redirect("/dashboard");
});
```

## 20. @fastify/formbody

文档：https://github.com/fastify/fastify-formbody

作用：解析 `application/x-www-form-urlencoded` 请求体。

注意点：它不处理 `multipart/form-data` 文件上传；文件上传要用 `@fastify/multipart`。

示例：

```ts
import formbody from "@fastify/formbody";

await fastify.register(formbody);

fastify.post("/login", async (request) => {
  return request.body;
});
```

## 21. @fastify/funky

文档：https://github.com/fastify/fastify-funky

作用：让路由 handler 更方便地返回函数式结构，比如 Either、Task 或无参函数。

注意点：这是偏函数式编程风格的插件，团队不熟悉 FP 抽象时会增加理解成本；要和项目错误处理约定对齐。

示例：

```ts
import funky from "@fastify/funky";

await fastify.register(funky);

fastify.get("/lazy", async () => () => ({ ok: true }));
```

## 22. @fastify/helmet

文档：https://github.com/fastify/fastify-helmet

作用：设置常见安全响应头，例如 CSP、HSTS、X-Frame-Options 等。

注意点：CSP 默认值可能影响 Swagger UI、前端资源、内联脚本或第三方 CDN；上线前要按页面资源逐项配置。

示例：

```ts
import helmet from "@fastify/helmet";

await fastify.register(helmet, {
  contentSecurityPolicy: false,
});
```

## 23. @fastify/hotwire

文档：https://github.com/fastify/fastify-hotwire

作用：在 Fastify 中使用 Hotwire/Turbo 这类服务端驱动交互模式。

注意点：适合服务端渲染和局部页面更新，不适合所有前后端分离 API 项目；需要和模板渲染、静态资源策略一起设计。

示例：

```ts
import hotwire from "@fastify/hotwire";

await fastify.register(hotwire);

fastify.get("/", async (request, reply) => {
  return reply.type("text/html").send('<turbo-frame id="main">hello</turbo-frame>');
});
```

## 24. @fastify/http-proxy

文档：https://github.com/fastify/fastify-http-proxy

作用：把某个前缀下的请求代理到上游服务，适合 API 网关、反向代理或规避浏览器 CORS。

注意点：`upstream` 里的 path 会被忽略，需要用 `rewritePrefix` 表示目标基础路径。代理请求会把非 JSON payload 直接流式转发，鉴权和 header 重写要显式配置。

示例：

```ts
import httpProxy from "@fastify/http-proxy";

await fastify.register(httpProxy, {
  upstream: "http://127.0.0.1:4000",
  prefix: "/api",
  rewritePrefix: "/",
});
```

## 25. @fastify/jwt

文档：https://github.com/fastify/fastify-jwt

作用：提供 JWT 签发和校验工具，基于 `fast-jwt`。

注意点：secret 或私钥必须安全管理；不要把长期敏感信息放进 token。业务上还要处理过期、刷新、注销和密钥轮换。

示例：

```ts
import jwt from "@fastify/jwt";

await fastify.register(jwt, { secret: process.env.JWT_SECRET! });

fastify.post("/token", async (request) => {
  return { token: fastify.jwt.sign({ sub: "user-1" }) };
});

fastify.get(
  "/me",
  {
    onRequest: async (request) => request.jwtVerify(),
  },
  async (request) => request.user,
);
```

## 26. @fastify/kafka

文档：https://github.com/fastify/fastify-kafka

作用：在 Fastify 中共享 Kafka client/producer/consumer，用于和 Apache Kafka 交互。

注意点：Kafka 连接、consumer group、重试和优雅关闭要按业务处理；不要在 handler 里频繁创建 producer。

示例：

```ts
import kafka from "@fastify/kafka";

await fastify.register(kafka, {
  clientConfig: { brokers: ["127.0.0.1:9092"] },
});

fastify.post("/events", async function (request) {
  await this.kafka.producer.send({ topic: "events", messages: [{ value: JSON.stringify(request.body) }] });
  return { ok: true };
});
```

## 27. @fastify/leveldb

文档：https://github.com/fastify/fastify-leveldb

作用：在 Fastify 中共享 LevelDB 连接。

注意点：LevelDB 是本地嵌入式 KV 存储，不适合多进程同时写同一数据目录；容器部署要考虑持久化卷。

示例：

```ts
import leveldb from "@fastify/leveldb";

await fastify.register(leveldb, { name: "db", path: "./data/level" });

fastify.get("/kv/:key", async function (request) {
  return { value: await this.level.db.get(request.params.key) };
});
```

## 28. @fastify/middie

文档：https://github.com/fastify/middie

作用：给 Fastify 提供中间件引擎，用于挂载 Connect/Express 风格 middleware。

注意点：Fastify 官方更推荐 hook 和插件模型；只有在必须复用中间件生态时才引入。

示例：

```ts
import middie from "@fastify/middie";

await fastify.register(middie);

fastify.use((req, res, next) => {
  req.headers["x-from-middleware"] = "1";
  next();
});
```

## 29. @fastify/mongodb

文档：https://github.com/fastify/fastify-mongodb

作用：共享 MongoDB 连接或连接池。

注意点：连接 URI、认证、TLS、数据库名和索引策略要独立配置；不要在请求里重复 `new MongoClient()`。

示例：

```ts
import mongodb from "@fastify/mongodb";

await fastify.register(mongodb, {
  url: process.env.MONGO_URL,
});

fastify.get("/users", async function () {
  return this.mongo.db!.collection("users").find({}).limit(10).toArray();
});
```

## 30. @fastify/multipart

文档：https://github.com/fastify/fastify-multipart

作用：解析 `multipart/form-data`，支持文件流、字段、临时文件、按请求设置上传限制。

注意点：文件流必须被消费，否则 Promise 可能不会结束。务必设置 `limits.fileSize`、`files`、`parts`；使用 `toBuffer()` 会把文件读进内存，不能直接用于大文件。

示例：

```ts
import multipart from "@fastify/multipart";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

await fastify.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

fastify.post("/upload", async (request) => {
  const file = await request.file();
  if (!file) return { ok: false };
  await pipeline(file.file, createWriteStream(`./uploads/${file.filename}`));
  return { ok: true };
});
```

## 31. @fastify/mysql

文档：https://github.com/fastify/fastify-mysql

作用：共享 MySQL 连接或连接池。

注意点：生产环境建议使用 pool，配置连接上限、超时和错误处理；SQL 参数必须使用占位符避免注入。

示例：

```ts
import mysql from "@fastify/mysql";

await fastify.register(mysql, {
  connectionString: process.env.MYSQL_URL,
  promise: true,
});

fastify.get("/users", async function () {
  const [rows] = await this.mysql.query("select id, name from users limit ?", [10]);
  return rows;
});
```

## 32. @fastify/nextjs

文档：https://github.com/fastify/fastify-nextjs

作用：在 Fastify 中托管 Next.js 应用或页面。

注意点：需要处理 Next.js 构建、静态资源和 SSR 生命周期；API 服务和前端 SSR 混跑时要清晰区分路由前缀。

示例：

```ts
import nextjs from "@fastify/nextjs";

await fastify.register(nextjs);

fastify.next("/app");
```

## 33. @fastify/oauth2

文档：https://github.com/fastify/fastify-oauth2

作用：封装 OAuth2 授权码流程，便于接入 GitHub、Google 等 OAuth2 Provider。

注意点：`callbackUri` 必须和第三方平台配置一致；client secret 不要写入仓库；要校验 state 并妥善保存 token。

示例：

```ts
import oauth2 from "@fastify/oauth2";

await fastify.register(oauth2, {
  name: "githubOAuth2",
  credentials: {
    client: { id: process.env.GITHUB_CLIENT_ID!, secret: process.env.GITHUB_CLIENT_SECRET! },
    auth: oauth2.GITHUB_CONFIGURATION,
  },
  startRedirectPath: "/login/github",
  callbackUri: "http://localhost:3000/login/github/callback",
});
```

## 34. @fastify/one-line-logger

文档：https://github.com/fastify/one-line-logger

作用：作为 Pino transport，把 Fastify JSON 日志格式化成一行可读文本。

注意点：它不是 `register()` 插件，而是在创建 Fastify 实例时配置 logger transport。生产日志如果要给日志平台采集，通常仍保留 JSON 更合适。

示例：

```ts
import Fastify from "fastify";

const fastify = Fastify({
  logger: {
    transport: { target: "@fastify/one-line-logger", colorize: false },
  },
});
```

## 35. @fastify/otel

文档：https://github.com/fastify/otel

作用：为 Fastify 请求、路由 handler、生命周期 hook 提供 OpenTelemetry instrumentation。

注意点：要在定义路由和注册其他插件之前接入，覆盖范围才完整；通常还需要配置 OpenTelemetry SDK、exporter、service name 和 HTTP instrumentation。

示例：

```ts
import FastifyOtelInstrumentation from "@fastify/otel";

const otel = new FastifyOtelInstrumentation({
  ignorePaths: (opts) => opts.url === "/health",
});

await fastify.register(otel.plugin());
```

## 36. @fastify/passport

文档：https://github.com/fastify/fastify-passport

作用：在 Fastify 中使用 Passport 策略做认证。

注意点：Passport 通常依赖 session 或序列化用户逻辑；如果项目只做纯 JWT API，引入 Passport 可能偏重。

示例：

```ts
import passport from "@fastify/passport";

await fastify.register(passport.initialize());
await fastify.register(passport.secureSession());

fastify.get(
  "/login",
  {
    preValidation: passport.authenticate("local", { authInfo: false }),
  },
  async () => ({ ok: true }),
);
```

## 37. @fastify/postgres

文档：https://github.com/fastify/fastify-postgres

作用：共享 PostgreSQL 连接池。

注意点：配置 pool 大小、连接超时和事务边界；SQL 参数必须使用占位符。和 ORM 共用时避免创建两套池。

示例：

```ts
import postgres from "@fastify/postgres";

await fastify.register(postgres, {
  connectionString: process.env.POSTGRES_URL,
});

fastify.get("/now", async function () {
  const { rows } = await this.pg.query("select now()");
  return rows[0];
});
```

## 38. @fastify/rate-limit

文档：https://github.com/fastify/fastify-rate-limit

作用：对路由或全局请求做限流，防止暴力请求和资源滥用。

注意点：默认内存计数不适合多实例一致限流；生产环境通常需要 Redis 等外部存储。要对登录、短信、上传等高风险接口单独设限。

示例：

```ts
import rateLimit from "@fastify/rate-limit";

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

fastify.get("/limited", async () => ({ ok: true }));
```

## 39. @fastify/redis

文档：https://github.com/fastify/fastify-redis

作用：共享 Redis 连接，供缓存、分布式锁、限流、队列等使用。

注意点：要设置认证、TLS、连接超时和错误监听；Redis 不应当被当作唯一持久化数据库使用。

示例：

```ts
import redis from "@fastify/redis";

await fastify.register(redis, { url: process.env.REDIS_URL });

fastify.get("/cache/:key", async function (request) {
  return { value: await this.redis.get(request.params.key) };
});
```

## 40. @fastify/reply-from

文档：https://github.com/fastify/fastify-reply-from

作用：在单个 route handler 中把当前请求转发到另一个 HTTP 服务。

注意点：如果要按前缀代理一组路由，优先看 `@fastify/http-proxy`。转发时要显式处理超时、header 改写和错误映射。

示例：

```ts
import replyFrom from "@fastify/reply-from";

await fastify.register(replyFrom);

fastify.get("/upstream/*", async (request, reply) => {
  return reply.from("http://127.0.0.1:4000" + request.url.replace("/upstream", ""));
});
```

## 41. @fastify/request-context

文档：https://github.com/fastify/fastify-request-context

作用：基于 `AsyncLocalStorage` 提供请求级上下文，常用于保存 request id、当前用户、请求级 logger。

注意点：必须在你需要读取上下文的生命周期之前初始化；脱离请求的异步任务不会天然继承当前请求上下文。

示例：

```ts
import { fastifyRequestContext, requestContext } from "@fastify/request-context";

await fastify.register(fastifyRequestContext, {
  defaultStoreValues: (request) => ({ requestId: request.id }),
});

fastify.get("/ctx", async () => ({ requestId: requestContext.get("requestId") }));
```

## 42. @fastify/response-validation

文档：https://github.com/fastify/fastify-response-validation

作用：按 route `schema.response` 校验 handler 返回值。

注意点：会降低性能，官方建议主要用于开发或测试环境；生产环境如果开启，要评估高流量接口成本。

示例：

```ts
import responseValidation from "@fastify/response-validation";

await fastify.register(responseValidation);

fastify.get(
  "/answer",
  {
    schema: { response: { 200: { type: "object", properties: { answer: { type: "number" } } } } },
  },
  async () => ({ answer: 42 }),
);
```

## 43. @fastify/routes

文档：https://github.com/fastify/fastify-routes

作用：把已注册路由收集到 `fastify.routes` Map 中，便于调试、文档或运行时检查。

注意点：必须在要收集的路由之前注册，否则之前的路由不会出现在 Map 里。

示例：

```ts
import routes from "@fastify/routes";

await fastify.register(routes);

fastify.get("/hello", async () => ({ hello: "world" }));

await fastify.ready();
fastify.log.info([...fastify.routes.keys()]);
```

## 44. @fastify/routes-stats

文档：https://github.com/fastify/fastify-routes-stats

作用：基于 `node:perf_hooks` 统计路由耗时，并可定时打印或通过 `fastify.stats()` 获取。

注意点：这是应用内统计，不是完整 APM；高要求观测建议接入 OpenTelemetry 或专业监控系统。

示例：

```ts
import routesStats from "@fastify/routes-stats";

await fastify.register(routesStats, { printInterval: 30000 });

fastify.get("/__stats__", async function () {
  return this.stats();
});
```

## 45. @fastify/schedule

文档：https://github.com/fastify/fastify-schedule

作用：基于 `toad-scheduler` 在 Fastify 内调度周期任务。

注意点：多实例部署时每个实例都会跑同一个任务；需要全局唯一执行时要加分布式锁或改用外部调度系统。

示例：

```ts
import schedule from "@fastify/schedule";
import { SimpleIntervalJob, Task } from "toad-scheduler";

await fastify.register(schedule);

fastify.scheduler.addSimpleIntervalJob(new SimpleIntervalJob({ seconds: 60 }, new Task("heartbeat", () => fastify.log.info("tick"))));
```

## 46. @fastify/secure-session

文档：https://github.com/fastify/fastify-secure-session

作用：把 session 数据加密后存进客户端 Cookie，提供无服务端存储的安全 Cookie session。

注意点：密钥长度必须满足要求，生产环境应放在 KMS/Vault/环境变量等安全来源；Cookie 泄露仍可被冒用，要设置合理 `expiry`、`httpOnly`、`secure` 和 key rotation。

示例：

```ts
import secureSession from "@fastify/secure-session";

await fastify.register(secureSession, {
  secret: process.env.SESSION_SECRET!,
  salt: process.env.SESSION_SALT!,
  cookie: { path: "/", httpOnly: true, secure: true },
});

fastify.post("/session", async (request) => {
  request.session.set("userId", "u1");
  return { ok: true };
});
```

## 47. @fastify/sensible

文档：https://github.com/fastify/fastify-sensible

作用：提供一组通用装饰器和工具，例如 HTTP errors、assert、reply helpers。

注意点：它会改变错误创建和返回的便利方式，但不替代统一错误处理；团队要约定何时用 `httpErrors`。

示例：

```ts
import sensible from "@fastify/sensible";

await fastify.register(sensible);

fastify.get("/missing", async function () {
  throw this.httpErrors.notFound("resource not found");
});
```

## 48. @fastify/session

文档：https://github.com/fastify/session

作用：提供服务端 session，session id 存 Cookie，数据存服务端 store。

注意点：必须先注册 `@fastify/cookie`。默认内存 store 不适合生产环境，会泄漏内存且不支持多实例共享；`secret` 长度至少 32 字符。HTTP 本地开发可能要设置 `cookie.secure: false`。

示例：

```ts
import cookie from "@fastify/cookie";
import session from "@fastify/session";

await fastify.register(cookie);
await fastify.register(session, {
  secret: process.env.SESSION_SECRET!,
  cookie: { secure: false },
});

fastify.get("/visit", async (request) => {
  request.session.set("visited", true);
  return { visited: request.session.get("visited") };
});
```

## 49. @fastify/sse

文档：https://github.com/fastify/sse

作用：为 Fastify 提供 Server-Sent Events 支持，可发送单条消息、异步迭代器、流，并支持心跳和重连 replay。

注意点：SSE 是单向服务端推送，不适合客户端到服务端高频双向通信；长期连接要处理断开、心跳、代理超时和资源释放。

示例：

```ts
import sse from "@fastify/sse";

await fastify.register(sse, { heartbeatInterval: 30000 });

fastify.get("/events", { sse: true }, async (request, reply) => {
  reply.sse.keepAlive();
  await reply.sse.send({ event: "ready", data: { ok: true } });
});
```

## 50. @fastify/static

文档：https://github.com/fastify/fastify-static

作用：高性能托管静态文件，例如图片、前端构建产物、下载文件。

注意点：要限制 `root` 到安全目录；缓存头、目录索引、下载文件名和 SPA fallback 要按场景配置。

示例：

```ts
import staticPlugin from "@fastify/static";
import { join } from "node:path";

await fastify.register(staticPlugin, {
  root: join(process.cwd(), "public"),
  prefix: "/public/",
});
```

## 51. @fastify/swagger

文档：https://github.com/fastify/fastify-swagger

作用：根据 Fastify route schema 生成 Swagger/OpenAPI 文档对象，也可以加载静态 OpenAPI 文件。

注意点：必须在路由注册之前注册，之前注册的路由不会进入文档。它只生成文档数据，UI 页面通常还要配合 `@fastify/swagger-ui`。

示例：

```ts
import swagger from "@fastify/swagger";

await fastify.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: { title: "API", version: "1.0.0" },
  },
});
```

## 52. @fastify/swagger-ui

文档：https://github.com/fastify/fastify-swagger-ui

作用：提供 Swagger UI 页面，展示 `@fastify/swagger` 生成的 API 文档。

注意点：要在 `@fastify/swagger` 之后注册。生产环境是否公开 `/docs` 要谨慎，内部接口建议加鉴权或仅内网访问。

示例：

```ts
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

await fastify.register(swagger, {
  openapi: { openapi: "3.0.0", info: { title: "API", version: "1.0.0" } },
});
await fastify.register(swaggerUi, { routePrefix: "/docs" });
```

## 53. @fastify/throttle

文档：https://github.com/fastify/fastify-throttle

作用：限制响应下载速度，适合控制大文件下载或特定接口的带宽占用。

注意点：它控制的是传输速度，不是请求频率；请求频率限制要用 `@fastify/rate-limit`。

示例：

```ts
import throttle from "@fastify/throttle";

await fastify.register(throttle, { bytesPerSecond: 1024 * 100 });

fastify.get("/download", async (request, reply) => {
  return reply.send("large content");
});
```

## 54. @fastify/type-provider-json-schema-to-ts

文档：https://github.com/fastify/fastify-type-provider-json-schema-to-ts

作用：用 `json-schema-to-ts` 从 JSON Schema 推导 Fastify 请求和响应类型。

注意点：这是 TypeScript 类型工具，不是运行时校验插件；运行时校验仍由 Fastify/Ajv 根据 schema 完成。

示例：

```ts
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";

const typed = fastify.withTypeProvider<JsonSchemaToTsProvider>();

typed.get(
  "/typed",
  {
    schema: {
      querystring: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      } as const,
    },
  },
  async (request) => ({ hello: request.query.name }),
);
```

## 55. @fastify/type-provider-typebox

文档：https://github.com/fastify/fastify-type-provider-typebox

作用：让 Fastify 和 TypeBox 配合，从 TypeBox schema 推导请求/响应类型。

注意点：同样是类型 provider，不替代运行时校验；需要用 TypeBox 的 `Type.*` 定义 schema。

示例：

```ts
import { Type } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

const typed = fastify.withTypeProvider<TypeBoxTypeProvider>();

typed.get(
  "/typebox",
  {
    schema: {
      querystring: Type.Object({ name: Type.String() }),
    },
  },
  async (request) => ({ hello: request.query.name }),
);
```

## 56. @fastify/under-pressure

文档：https://github.com/fastify/under-pressure

作用：监控进程负载、事件循环延迟、内存、健康检查，在压力过高时自动返回 503。

注意点：阈值不能照抄示例，要按机器规格和业务延迟基线压测后设置；健康检查接口应放给负载均衡使用。

示例：

```ts
import underPressure from "@fastify/under-pressure";

await fastify.register(underPressure, {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: 1024 * 1024 * 1024,
  exposeStatusRoute: "/status",
});
```

## 57. @fastify/url-data

文档：https://github.com/fastify/fastify-url-data

作用：给 request 增加读取原始 URL 组成部分的方法。

注意点：适合需要原始 path、query、hash 等信息的场景；普通业务参数优先用 Fastify 的 `params` 和 `querystring` schema。

示例：

```ts
import urlData from "@fastify/url-data";

await fastify.register(urlData);

fastify.get("/raw/*", async (request) => {
  return request.urlData();
});
```

## 58. @fastify/view

文档：https://github.com/fastify/point-of-view

作用：为 Fastify 提供模板渲染能力，支持 ejs、pug、handlebars、marko 等模板引擎。

注意点：模板引擎需要单独安装；用户输入必须转义，避免 XSS。模板路径和布局策略要统一。

示例：

```ts
import view from "@fastify/view";
import ejs from "ejs";

await fastify.register(view, {
  engine: { ejs },
  root: "./views",
});

fastify.get("/page", async (request, reply) => {
  return reply.view("index.ejs", { title: "Home" });
});
```

## 59. @fastify/vite

文档：https://github.com/fastify/fastify-vite

作用：把 Vite 开发服务和构建产物集成进 Fastify，支持 SPA、MPA、SSR 等前端应用托管。

注意点：开发和生产模式的 Vite 行为不同；SSR 项目要明确服务端入口、前端路由和静态资源输出目录。

示例：

```ts
import fastifyVite from "@fastify/vite";

await fastify.register(fastifyVite, {
  root: import.meta.url,
  dev: process.env.NODE_ENV !== "production",
});

await fastify.vite.ready();
```

## 60. @fastify/websocket

文档：https://github.com/fastify/fastify-websocket

作用：基于 `ws` 给 Fastify 路由提供 WebSocket 支持。

注意点：必须在相关路由之前注册，才能拦截升级请求。WebSocket handler 中要同步挂上 `message` 等事件监听，避免异步初始化期间丢消息。

示例：

```ts
import websocket from "@fastify/websocket";

await fastify.register(websocket);

fastify.get("/ws", { websocket: true }, (socket, request) => {
  socket.on("message", (message) => {
    socket.send(`echo: ${message.toString()}`);
  });
});
```

## 61. @fastify/zipkin

文档：https://github.com/fastify/fastify-zipkin

作用：把 Fastify 请求接入 Zipkin 分布式追踪。

注意点：新项目通常会优先评估 OpenTelemetry；如果现有链路已经是 Zipkin，可以用它保持兼容。需要配置采样、collector 地址和 trace header 传递。

示例：

```ts
import zipkin from "@fastify/zipkin";

await fastify.register(zipkin, {
  serviceName: "fastify-api",
  httpReporterUrl: "http://127.0.0.1:9411/api/v2/spans",
});
```
