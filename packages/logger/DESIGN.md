# 日志功能包设计（@repo/logger）

> **状态**：已按第 19 节落地（`packages/logger` + `apps/services` 接线，实测通过）。
> 第 1–18 节是最初的设计推理，**与最终实现有若干偏差**；凡有冲突，以 **第 19 节（as-built）** 为准。
> 关键偏差：脱敏移到子进程、取消降级、`time` 由子进程生成、新增主进程净化层、multipart 记文件元信息。

---

## 1. 摘要（一页看懂）

自研一个**零运行时依赖**的日志功能包 `@repo/logger`，替换 `pino`：

- **主服务**里只保留一个极薄的 logger facade（满足 Fastify 的 `FastifyBaseLogger` 契约）
- **写盘、按天切分、30 天保留**全部放进一个**子进程**，由主服务 spawn，随主服务启动/关闭
- 日志落盘仍是**一行一条 JSON**（NDJSON），格式与现有 `logs/` 文件保持兼容
- **实时查看**通过"直接读文件"实现：CLI（`tail/cat/ls`）+ 后续可选的 admin 后台接口，**不经过子进程**

一句话分工：**主服务负责"造日志"，子进程负责"落日志"，查看功能直接读文件。**

---

## 2. 背景与现状问题

### 2.1 现状

| 环节         | 位置                                | 说明                                                                                |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| 日志 facade  | pino（`apps/services/src/app.ts`）  | 级别、`redact` 脱敏、`formatters`、自定义 `timestamp`                               |
| 写盘         | `src/core/access-log-transport.mjs` | pino transport，跑在 **worker 线程**；按 `logType` 分 `router/`、`log/`，按天切文件 |
| 请求日志采集 | `src/plugins/logger.ts`             | `preValidation` 钩子，打 `logType: "router"`，跳过 `/docs`、`/api/health`           |
| 错误日志     | `src/core/error-handler.ts`         | 404/4xx/5xx 打 warn/error，落到 `logs/log/`                                         |
| 退出前 flush | `src/server.ts`                     | `app.log.flush()` + 2s `Promise.race`                                               |
| 保留策略     | —                                   | **完全没有**，`logs/` 只增不减                                                      |
| 打包         | `scripts/build.ts`                  | `copyRuntimeFiles()` 把 `.mjs` 拷进 dist                                            |

### 2.2 实测问题（本机 Node 25.6.0 / Windows / 28 逻辑核）

单条请求日志 661 字节，20,000 条连续写入的实测结果：

| 指标                | 当前实现            |
| ------------------- | ------------------- |
| 主线程单次耗时 平均 | 4.61 µs             |
| p50 / p99 / max     | 3.9 / 11.8 / 759 µs |
| 1MB body（1 条）    | **734 µs**          |
| 吞吐                | 214,000 行/秒       |

由此定位到 **4 个必须解决的问题**：

| #   | 问题                           | 证据                                                                                                            | 影响                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **没有保留策略**               | `logs/` 无任何清理逻辑                                                                                          | 磁盘只增不减，最终写满                         |
| 2   | **SAB 写满会同步阻塞主线程**   | `thread-stream@4.2.0` 的 `flushSync()` 里 `Atomics.wait`，最多自旋 10×1000ms，超时抛 `_flushSync took too long` | 约 6000 条积压即填满 4MB 缓冲，所有 API 一起卡 |
| 3   | **慢盘不阻塞，但内存无界上涨** | `access-log-transport.mjs:46` 的 `stream.write()` 忽略返回值（丢背压）                                          | 慢盘/大批量时 worker 内存涨到撑爆进程          |
| 4   | **磁盘满时 worker 静默死亡**   | `access-log-transport.mjs:33` 的 `createWriteStream` 没有挂 `'error'` 监听                                      | 日志永久停止，API 照常响应，无人知晓           |

补充一条：pino 在 `process.on("exit")` 里注册了 `flushSync()` + `sleep(100)`（`pino/lib/transport.js:162-174`），所以 `server.ts` 里那个 "2s 超时" 实际拦不住同步阻塞——主线程被 `Atomics.wait` 卡住时定时器根本不会执行。

### 2.3 目标

1. **按天记录**：当天日志写当天文件 `YYYY-MM-DD.log`，长期运行**自动流转**（跨天不停机）
2. **只留最近 30 天**：超过的自动删除
3. **单文件上限 10MB（可配置）**：写满切 `YYYY-MM-DD.1.log`
4. **实时写入**：每条立即落盘，`tail` 毫秒级可见
5. **实时查看**：能跟进当前文件、支持按级别/关键词过滤
6. **子进程隔离**：日志系统故障（满盘、慢盘、崩溃）不拖累 API
7. **零依赖**：`dist` 里只多一个目录，不需要额外 `npm install`

### 2.4 非目标（明确不做）

| 不做                     | 原因                                                   |
| ------------------------ | ------------------------------------------------------ |
| 子进程内开 HTTP 服务     | 查看日志直接读文件更简单，少一个端口和安全面           |
| 远端上报（Loki/ES/OTLP） | 属于后续独立议题，用 sink 扩展位留口子                 |
| 业务操作审计（入库）     | 那是"审计日志"，和运行时日志是两件事，需要 DB 表和权限 |
| 日志查询/检索服务        | 30 天 NDJSON 文件 + `grep` 够用，真不够再引入日志平台  |
| 替代 `console.log`       | 启动提示仍走 stdout，日志走文件                        |

---

## 3. 选型：为什么自研

| 候选                        | 按天切分 | 保留 30 天（按日历日） | 两目录分流      | 子进程内可用  | 实时查看 | 依赖体量 |
| --------------------------- | -------- | ---------------------- | --------------- | ------------- | -------- | -------- |
| pino + pino-roll            | ✅       | ❌ 只能按**文件个数**  | ❌ 需自写       | ⚠️ 会再开线程 | ❌       | 中       |
| winston + daily-rotate-file | ✅       | ✅ `maxFiles:'30d'`    | ✅ 双 transport | ✅            | ❌       | **大**   |
| log4js（`dateFile`）        | ✅       | ❌ `numBackups` 按个数 | ✅ category     | ✅            | ❌       | 大       |
| **自研**                    | ✅       | ✅ 语义完全可控        | ✅              | ✅            | ✅       | **0**    |

决策理由：

1. **保留语义**是整个需求的核心。只有 winston 支持按天数，但它依赖 `auditFile`（"不会删除不在审计文件里的文件"），配置变更/容器重建后旧文件可能永远清不掉；其余都只能按文件个数保留。
2. **实时查看**所有库都不提供，反正要自己写。
3. **零依赖**让 `dist` 打包只是 `cp -r`，不需要 vendor `node_modules`，部署和排查面最小。
4. 顺带消掉 pino/thread-stream 的 SAB + `Atomics.wait` + 退出 `flushSync` 这三个已知阻塞点。

代价（必须承认）：正确性责任转移到我们身上——"绝不抛异常、绝不阻塞"必须靠不变量（第 13 节）+ 测试（第 17 节）保证。

---

## 4. 总体架构

```
┌──────────────────────────────────────────────────────────────┐
│ 主服务进程（Fastify :3030）                                   │
│                                                              │
│  plugins/logger.ts ─┐                                        │
│  error-handler.ts ──┼→ logger (facade) ─→ sink（有界队列）    │
│  app.ts / 业务代码 ─┘        │                    │          │
│                              │ 同步序列化          │ stdin    │
│                              ▼                    ▼          │
│                        NDJSON 一行  ────────→ 子进程 stdin    │
│                                                              │
│  child_process.spawn ←──────────────────────→ IPC 控制面      │
└──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│ 子进程（node dist/vendor/logger/dist/child-main.js）          │
│  stdin 消费 → 路由(router/ | log/) → 按天文件流 → 背压控制    │
│  启动/每小时 → retention（删 30 天前的文件）                  │
│  控制面：ready / stats / error / drain 回执                   │
└──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                        logs/router/2026-10-22.log
                        logs/log/2026-10-22.log
```

**关键边界**：

- **数据面**：主进程 → 子进程 stdin（NDJSON）。单生产者、FIFO 保序。
- **控制面**：IPC 通道，只传 `ready` / `stats` / `error` / `drain` 这类小消息。
- **查看**：任何进程都可以直接读文件，不需要经过子进程。

---

## 5. 包结构

> 决策 D1：位置（`packages/logger` vs `apps/logger`），见第 15 节。

```
packages/logger/
├── package.json          # @repo/logger，type:module，dependencies 为空（只用 node: 内置模块）
├── tsconfig.json
├── README.md             # 使用说明（简短，指向 DESIGN.md）
├── DESIGN.md             # 本文件
├── test/
│   └── logger.test.mjs   # node:test，零依赖；`pnpm --filter @repo/logger test`
└── src/
    ├── index.ts          # 对外导出：createLogger / createChildSink / createDirectSink / createOffSink
    ├── types.ts          # LogRecord / LogLevel / 日志配置类型
    ├── protocol.ts       # 主↔子 消息类型 + 协议版本号
    ├── logger.ts         # facade：级别过滤 / child() / 序列化 / redact / flush
    ├── sink.ts           # spawn 子进程 + 有界队列 + 降级 + 重启退避 + NDJSON 补换行
    ├── direct-sink.ts    # 直接调用 writer 的降级实现（主进程内写）
    ├── off-sink.ts       # LOG_MODE=off / 测试用空实现
    ├── child-main.ts     # 子进程入口：stdin 消费 + 控制面 + 信号/EOF 退出
    ├── writer.ts         # 按 logType/日期 选流、切分、写入、背压（被 child 和 direct 共用）
    ├── retention.ts      # 30 天清理
    ├── time.ts           # ymd() / 本地时间格式化（唯一时间来源）
    ├── viewer.ts         # 纯文件读取：list / readRange / tail
    └── cli.ts            # 命令行：ls / cat / tail
```

**设计约束：`writer.ts` / `retention.ts` / `time.ts` 不依赖子进程环境**，同一份代码既跑在子进程（正常模式），也跑在主进程（`LOG_MODE=direct` 降级模式）。这样降级路径不是"另写的应急代码"，而是每天都在用同一套实现。

---

## 6. 数据契约（落盘格式）

### 6.1 一行示例

```json
{
  "level": "info",
  "time": "2026-10-22 11:00:46",
  "ts": 1761111606123,
  "pid": 35084,
  "logType": "router",
  "stage": "request",
  "method": "GET",
  "url": "/api/user/list?page=1",
  "requestId": "3e85b1ca-e623-4b7e-b6bf-dd752cd15fb0",
  "ip": "127.0.0.1",
  "body": { "page": 1 },
  "query": { "page": "1" },
  "params": {},
  "headers": { "host": "localhost:3030", "authorization": "[Redacted]" },
  "msg": ""
}
```

### 6.2 字段

| 字段      | 类型   | 必有 | 说明                                                                    |
| --------- | ------ | ---- | ----------------------------------------------------------------------- |
| `level`   | string | ✅   | 级别**标签**（`info`/`warn`…），与现有历史文件一致，便于 grep           |
| `time`    | string | ✅   | 本地时间 `YYYY-MM-DD HH:mm:ss`，**兼容历史格式**（决策 D2）             |
| `ts`      | number | ✅   | epoch 毫秒，**切分文件、排序只看它**，不解析 `time` 字符串              |
| `logType` | string | 可选 | `router` → `logs/router/`；缺省或其它 → `logs/log/`                     |
| `msg`     | string | 可选 | 放最后，人眼可读                                                        |
| `err`     | object | 可选 | `Error` 序列化为 `{type,message,stack,code}`，不走普通 `JSON.stringify` |
| 其它      | any    | 可选 | bindings（`pid` 等）与业务字段，原样保留                                |

### 6.3 序列化规则

1. **字段顺序固定**：`level` → `time` → `ts` → bindings → 业务字段 → `msg`。顺序稳定，便于 `grep`、日志平台解析和人工阅读。
2. **一行一条**：所有字符串内部换行由 `JSON.stringify` 转义，天然满足 NDJSON。
3. **脱敏在主服务侧完成**（跨进程之前），默认路径：
   `headers.authorization`、`headers.cookie`、`headers["set-cookie"]`、`body.password`、`body.newPassword`、`body.token`，替换为 `"[Redacted]"`。
4. **`Error` 特判**：`{ err }` / `{ error }` 值为 `Error` 实例时转 `{type,message,stack,code}`；其它情况按普通对象处理。
5. **不做 printf 格式化魔法**（`%s` 之类）：只支持 `(obj, msg)` / `(msg)` 两种签名，避免行为歧义。
6. **兼容性承诺**：`level` / `time` / `logType` / `msg` 字段名与现有 `logs/` 文件完全一致，历史日志和新日志可以用同一套脚本分析。

---

## 7. 主服务侧：logger facade

### 7.1 必须满足的契约

Fastify 5 对 logger 的要求只有这些（`fastify@5.12.7/types/logger.d.ts:27`）：

```ts
interface FastifyBaseLogger {
  level: string;
  silent / fatal / error / warn / info / debug / trace: LogFn;
  child(bindings, options?): FastifyBaseLogger;
}
```

### 7.2 API

```ts
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerOptions {
  level?: LogLevel; // 默认 info
  base?: Record<string, unknown>; // 固定字段，如 { pid: process.pid }
  redact?: string[]; // 额外脱敏路径（与默认路径合并）
  sink: LogSink; // 见 7.4
}

export interface RepoLogger {
  level: LogLevel; // 可读可写（运行时热改）
  trace / debug / info / warn / error / fatal(objOrMsg?, msg?, ...args?): void;
  silent(): void;
  child(bindings: Record<string, unknown>, options?: { level?: LogLevel }): RepoLogger;
  isLevelEnabled(level: LogLevel): boolean;
  flush(cb?: (err?: Error) => void): void;
}
```

### 7.3 接入 Fastify

```ts
const logger = createLogger({ level: env.LOG_LEVEL, base: { pid: process.pid }, sink });
const app = Fastify({
  loggerInstance: logger, // 注意：不能同时传 logger，二者互斥
  logController: new LogController({ disableRequestLogging: true }),
});
```

- `logger` 与 `loggerInstance` **互斥**（`fastify/lib/logger-factory.js:83` 直接抛错），只传后者。
- `logController` 是独立选项，与 `loggerInstance` 可以共存（已验证）。
- `src/plugins/logger.ts`、`src/core/error-handler.ts` **不需要修改**——它们只调用 `fastify.log` / `request.log`。

### 7.4 Sink 接口

```ts
export interface LogSink {
  write(line: string): void; // 同步、不抛、不阻塞
  flush(cb?: () => void): void; // 排空队列
  end(cb?: () => void): void; // 排空 + 关闭（退出用）
  stats(): SinkStats; // 状态与丢弃计数
}
```

三个实现：`createChildSink`（正常）、`createDirectSink`（降级/单进程）、`createOffSink`（测试/关闭）。

### 7.5 性能约束（不可违反）

| #   | 约束                                                       | 理由                                                     |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `child()` 必须是 **O(1)**，不得拷贝 bindings 对象          | Fastify **每个请求**都调用一次 `logger.child({ reqId })` |
| 2   | **先判级别再序列化**：`debug` 被过滤时应该是纯函数调用成本 | 避免为不写的日志付序列化代价                             |
| 3   | 整对象只做**一次** `JSON.stringify`（业务字段），拼装手写  | 比整对象 stringify 更快且字段顺序可控                    |
| 4   | 整个 `write` 路径 **try/catch 包住**，失败只计数不抛       | 日志失败绝不能影响请求                                   |
| 5   | 不做任何同步 IO、不 `await`、不 `process.nextTick` 排队    | 请求路径上必须无等待                                     |

**性能预算**（相对当前 pino 实现）：单条 661B ≤ 6 µs；1MB body ≤ 900 µs；p99 ≤ 20 µs。

### 7.6 请求链路（实测基线对照）

现在每个请求的日志成本 = `preValidation` 里一次 `logger.info(...)`：4.61 µs（661B）。换成自研 facade 后，省掉 thread-stream 的 `setImmediate` + 二次拷贝，预期**不劣于**该基线。

---

## 8. 子进程：writer 与编排

### 8.1 启动

```
node <dist>/vendor/logger/dist/child-main.js --log-dir <绝对路径> --retention-days 30 [--max-file-mb 10] [--timezone Asia/Shanghai]
```

| 项                   | 设计                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| 配置来源             | **argv**（`ps` 可查）；环境只透传 `TZ` 与几个系统变量                      |
| 为什么不透传全量 env | 子进程不需要 `APP_DATABASE_URL`、JWT 密钥等敏感变量，最小化暴露面          |
| stdio                | `["pipe", "inherit", "inherit", "ipc"]`：数据面 / stdout / stderr / 控制面 |
| 工作目录             | `dist` 根（与主服务一致）                                                  |
| Windows              | `windowsHide: true`，路径全部显式绝对路径，不用 shell                      |

### 8.2 启动序列

1. 解析 argv，校验参数（非法参数 → 写 stderr 后 `exit(2)`）
2. `mkdir -p logs/router logs/log`
3. 执行一次 `retention()`（异步，不阻塞启动）
4. 启动 1 小时定时器（`unref()`）：负责 retention 与"空闲跨天"兜底
5. 开始消费 stdin
6. 通过 IPC 发 `{type:"ready", pid}`

### 8.3 写入路径

```
一行 NDJSON → 提取 ts / logType → 选中文件流 → stream.write(line + "\n")
```

**路由提取优化**：因为字段顺序固定（`level`→`time`→`ts`→`logType`），前 200 字节内必然包含 `"ts"` 和 `"logType"`，所以先对**头部切片**做正则提取，**避免为 1MB 的 body 做整行 `JSON.parse`**。解析失败则回退全量 `JSON.parse`；仍失败 → 丢行 + 计数（不进文件，避免污染）。

**实时性**：每条立即 `write()`（一次 syscall，进 OS page cache），**不做批量攒包、不做 fsync**，保证 `tail -f` / `Get-Content -Wait` 毫秒级可见。

**背压链（这是相比现在最大的改进）**：

```
磁盘慢 → fs.WriteStream 缓冲高水位 → stream.write() 返回 false
      → 子进程 process.stdin.pause()
      → OS 管道满 → 主进程 child.stdin.write() 返回 false
      → sink 队列达到水位 → 按策略丢弃 + 计数
```

整条链是**端到端真实流控**；pino transport 那套因为忽略了 `write()` 返回值，链路在中间就断了（只涨内存）。

### 8.4 轮转

| 规则       | 设计                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| 日切       | 每条按 `ts` 算当天日期，与当前流不一致就 `end()` 旧流、开新流（**惰性**，无需定时器） |
| 文件名     | `logs/router/YYYY-MM-DD.log`、`logs/log/YYYY-MM-DD.log`（**保持现有命名**）           |
| 空文件     | 懒创建：有日志才建文件，安静的一天不留空文件                                          |
| 单文件上限 | 默认 10MB（`LOG_MAX_FILE_MB`）：超过切 `YYYY-MM-DD.1.log`；`0` 关闭                   |
| 跨天边界   | 以子进程**本地时区**为准，`TZ` 由主进程显式传入，保证主/子一致                        |

### 8.5 30 天保留

```ts
cutoff = ymd(今天 - (retentionDays - 1)); // 含今天共 N 个日历日
保留 name.slice(0, 10) >= cutoff 的文件，其余删除
```

八条实现规则：

1. **按文件名日期判断，不用 `mtime`**（`mtime` 会被 rsync/拷贝/镜像重打戳）
2. **字典序字符串比较**，不算 `Date` 差值（跨月/跨年/闰年自然正确，时钟回拨也不会误删）
3. 严格正则才进候选：`/^\d{4}-\d{2}-\d{2}(\.\d+)?\.log(\.gz)?$/`，其它文件一律不动
4. 今天/昨天永不进候选（`cutoff` 已保证，再兜一层断言）
5. 触发时机：**启动一次 + 每小时一次**，绝不每写一条就 `readdir`
6. 两个子目录都扫（`router/`、`log/`）
7. 删除失败（Windows `EBUSY`、权限）**只 warn 不抛**，下一次再试
8. 单次删除上限（默认 200 个）防止参数写错把历史一次清空

清理统计（删了几个、跳过几个）通过 IPC `stats` 上报，启动时打一行汇总。

### 8.6 退出序列

1. 主服务：`logger.flush()` → 队列排空 → `sink.end()` → `child.stdin.end()`
2. 子进程：stdin EOF → 关闭所有流并等 `'finish'` → IPC 发 `{type:"bye",stats}` → `exit(0)`
3. 主服务等待 `exit`；**3 秒超时则 `kill()`**，不阻塞停机
4. 兜底：主进程被强杀（`kill -9` / `Stop-Process -Force`）→ 管道写端消失 → 子进程 stdin EOF → **自己退出**（Windows 无进程组信号，这是唯一可靠机制）；子进程另有 5s 一次的父 PID 探活作为双保险

---

## 9. 生命周期与故障恢复

### 9.1 状态机（主进程侧 sink）

| 状态       | 含义                     | 进入条件                      | 行为                              |
| ---------- | ------------------------ | ----------------------------- | --------------------------------- |
| `starting` | 已 spawn，未收到 `ready` | 启动时                        | 正常写（管道先缓存）              |
| `ready`    | 子进程就绪               | 收到 IPC `ready`              | 正常写                            |
| `restart`  | 子进程退出，等待重启     | `exit` 且未达上限             | 写暂存队列（有上限）              |
| `degraded` | 放弃子进程，降级直写     | 重启超限 / spawn 失败 / EPIPE | 切换 `directSink` 写，stderr 告警 |
| `stopped`  | 已关闭（进程退出中）     | `end()`                       | 丢弃并计数                        |

### 9.2 重启退避

| 条件                      | 行为                                       |
| ------------------------- | ------------------------------------------ |
| `exit code !== 0`         | 退避重启：200ms → 500ms → 1s → 2s → 5s     |
| 60 秒内重启 ≥ 5 次        | 停止重试，切 `degraded`，stderr 打醒目告警 |
| `spawn` 抛错（ENOENT 等） | 直接 `degraded`，不重试                    |
| `child.stdin` 报 EPIPE    | 标记 broken、切 `degraded`，**不抛**       |

### 9.3 丢弃策略（队列有界）

| 队列水位                       | 行为                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| < `maxBufferBytes`（默认 4MB） | 全量入队                                                   |
| ≥ 水位                         | 先丢 `trace/debug/info`，再丢 `warn`；`error/fatal` 尽量保 |
| 持续超水位                     | 达到硬上限（2×水位）后全丢，`dropped` 计数持续累加         |
| 恢复后                         | 打一条 `logger dropped N records in M ms` 的 warn          |

`dropped` 计数通过 `stats()` 暴露。

### 9.4 已知限制

| 限制                               | 说明                                                                 |
| ---------------------------------- | -------------------------------------------------------------------- |
| 同一 `LOG_DIR` 只允许一个实例      | 多实例写同一文件会交错（现有实现同样存在）。需要多实例则按实例分目录 |
| 强杀会丢最后若干条                 | 与现有实现一致；有界丢失可接受                                       |
| Windows 上删除被占用的旧文件会失败 | 只 warn，下一轮再试                                                  |

---

## 10. 实时查看

**核心原则：查看功能不依赖子进程，直接读文件。** 因此 `viewer.ts` 是纯函数模块，CLI 和未来的 admin 接口共用。

### 10.1 三层形态

| 层  | 形态       | 用法                                                                 |
| --- | ---------- | -------------------------------------------------------------------- |
| L1  | 系统自带   | `Get-Content -Wait logs\router\2026-10-22.log`（Windows）/ `tail -f` |
| L2  | 包内 CLI   | `node dist/vendor/logger/dist/cli.js tail --type router --follow`    |
| L3  | admin 后台 | `GET /system/logs`（P4，可选）                                       |

### 10.2 CLI 设计

```
node logger/cli.js ls   [--type router|log] [--json]
node logger/cli.js cat  [--date 2026-10-22] [--type router] [--level warn] [--grep 关键词] [--limit 1000] [--pretty]
node logger/cli.js tail [--type router] [--follow] [--lines 100] [--level warn] [--grep 关键词] [--pretty]
```

| 参数       | 说明                                                      |
| ---------- | --------------------------------------------------------- |
| `--follow` | 先输出最后 N 行，然后增量跟进；**午夜自动切到新文件**     |
| 跟进实现   | 500ms 轮询 `stat.size` 增量读（比 `fs.watch` 跨平台更稳） |
| `--level`  | 只显示 >= 该级别的行                                      |
| `--grep`   | 子串匹配（不做正则，避免误用）                            |
| `--pretty` | 单行彩色输出；默认原样 JSON，可管道给 `jq`                |
| `--dir`    | 覆盖日志根目录（默认 `$LOG_DIR` 或 `./logs`）             |

退出码：`0` 正常；`1` 参数错误；`2` 文件不存在。

### 10.3 viewer 模块 API

```ts
listFiles(dir): Promise<LogFileInfo[]>; // {name,date,size,mtime}
readRange(dir, file, { offset, limit, level?, grep? }): AsyncIterable<string>;
tail(dir, { type, lines, follow, level?, grep? }): AsyncIterable<string>;
```

### 10.4 admin 接口（P4，未实现）

| 路由                                | 说明                                    |
| ----------------------------------- | --------------------------------------- |
| `GET /system/log/files?type=router` | 文件列表（日期、大小、行数）            |
| `GET /system/log/read`              | 分页读取（`file` + `offset` + `limit`） |
| `GET /system/log/follow`            | SSE 跟进                                |

**安全清单（实现时必须逐条过）**：

1. 权限码接入现有 `permissions/` 体系（如 `system:log:view`）
2. 文件名白名单正则，**禁止 `..`、绝对路径、路径分隔符**
3. 单次响应上限（如 1MB）+ 分页强制
4. SSE 并发连接数上限 + 空闲超时
5. 只读，不提供删除/清空接口

---

## 11. 打包与部署

### 11.1 dist 结构

```
apps/services/dist/
├── server.js
├── package.json            # type: module
├── vendor/shared/          # @repo/shared（已有）
└── vendor/logger/          # 【新增】packages/logger/dist 整目录拷贝
    ├── package.json        # 只含 name/type/exports（零依赖）
    └── dist/
        ├── index.js
        ├── child-main.js
        ├── viewer.js
        └── cli.js
```

> 实现时改成了 `vendor/` 布局（原设计是 `dist/logger/`）：编译产物里保留的是裸包名
> `import ... from "@repo/logger"`，必须让 `npm install` 把它落进 `dist/node_modules/@repo/logger`，
> 所以走和 `@repo/shared` 完全相同的 `<pkg>: "file:./vendor/<pkg>"` 机制，不能只是一个裸目录。

### 11.2 构建集成

| 步骤                         | 内容                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `packages/logger` 的 `build` | `tsc -p tsconfig.json` → `dist/`（含 `.d.ts`）                                    |
| `apps/services/package.json` | 增加 `"@repo/logger": "workspace:*"`，turbo 自动排 `^build` 顺序                  |
| `scripts/build.ts` 新增      | `[build] vendor @repo/logger`：拷到 `dist/vendor/logger` 并生成最小 package.json  |
| 删除旧步骤                   | `copyRuntimeFiles()`（拷 `access-log-transport.mjs`）整段删除                     |
| dist 依赖声明                | `collectDependencies()` 把两个 workspace 包映射成 `file:./vendor/*`               |
| 依赖变化                     | **零新增运行时依赖**；同时从 dependencies 移除 `pino` / `pino-abstract-transport` |

### 11.3 路径解析（dev / prod 分叉，最容易翻车）

| 场景 | 主服务入口                     | 子进程入口解析                                                                  |
| ---- | ------------------------------ | ------------------------------------------------------------------------------- |
| dev  | `apps/services/src/server.ts`  | `require.resolve("@repo/logger")` → `<repo>/packages/logger/dist/child-main.js` |
| prod | `apps/services/dist/server.js` | `require.resolve("@repo/logger")` → `dist/vendor/logger/dist/child-main.js`     |

实现后不靠「猜层级」，而是按顺序找：

1. 显式传入的 `entryPath`；
2. `require.resolve("@repo/logger")` 所在目录的 `child-main.js`（dev / prod 都命中）；
3. 当前模块同目录的 `child-main.js`；
4. `../dist/child-main.js`、`../logger/child-main.js`（手工拷贝场景兜底）。

全都找不到时：**降级为主进程直写 + stderr 明确报错**，不允许静默不记日志。

包根定位（`LOG_DIR` 的解析）也一并收敛到 `apps/services/src/core/paths.ts` 的
`findPackageRoot()`：向上找 `package.json`，替换掉之前藏在 `app.ts` 里的 `isNestedInPackage` 推导。

### 11.4 开发态依赖

`turbo.json` 的 `dev` 已经配置 `dependsOn: ["^build"]`，所以 `pnpm dev` 会先构建 `@repo/logger`，dev 直接消费 `packages/logger/dist` 即可（不需要 tsx 跑 TS 源码）。

---

## 12. 配置项

| 环境变量                 | 默认    | 说明                                                     |
| ------------------------ | ------- | -------------------------------------------------------- |
| `LOG_DIR`                | `logs`  | 日志根目录（相对路径按包根解析，保持现有语义）           |
| `LOG_LEVEL`              | `info`  | 级别，支持 `fatal/error/warn/info/debug/trace/silent`    |
| `LOG_RETENTION_DAYS`     | `30`    | 保留天数（含今天）；`0` 表示不清理                       |
| `LOG_MAX_FILE_MB`        | `10`    | 单文件上限（MB），超过切 `.1.log`；`0` 关闭（决策 D3）   |
| `LOG_MODE`               | `child` | `child`（子进程）/ `direct`（主进程直写）/ `off`（关闭） |
| `LOG_SINK_MAX_BUFFER_MB` | `4`     | sink 有界队列水位（超水位开始丢）                        |
| `LOG_REDACT_EXTRA`       | 空      | 额外脱敏路径，逗号分隔                                   |
| `LOG_STDOUT`             | `false` | 是否同时输出到 stdout（容器/调试用）                     |
| `LOG_CHILD_RESTART_MAX`  | `5`     | 60 秒内允许的最大重启次数                                |

`LOG_DIR` / `LOG_LEVEL` 已存在，其余为新增；`.env.example` 与 README 的日志章节同步更新。

---

## 13. 不变量（硬规则，每条都要有测试）

| #   | 不变量                                                        | 违反后果           |
| --- | ------------------------------------------------------------- | ------------------ |
| 1   | 日志调用**永不抛异常**（含序列化、脱敏、写入、入队）          | 业务请求 500       |
| 2   | `child.stdin` 与 `child` 都必须挂 `'error'`（EPIPE 必须吞掉） | 主服务直接崩       |
| 3   | sink 队列**有界**，超限按策略丢弃并计数                       | 内存打爆           |
| 4   | 子进程崩溃 → 退避重启 → 超限降级，**不 fork 风暴**            | 无限重启、CPU 打满 |
| 5   | 磁盘满/写失败 → 子进程**不退出、不堵管道**，只丢数据并上报    | 主服务被背压拖死   |
| 6   | 子进程在 stdin EOF 时**必然退出**                             | 僵尸进程堆积       |
| 7   | 主/子进程时区一致（显式传 `TZ`）                              | 跨天切错文件       |
| 8   | 同一 `LOG_DIR` 只允许一个实例（文档约束）                     | 日志行交错损坏     |
| 9   | 保留策略只删除**严格匹配文件名正则**的文件                    | 误删运维文件       |
| 10  | 关闭流程**有超时**（3s），不阻塞进程退出                      | 停不下来           |

---

## 14. 落地改动清单（文件级）

| 文件                                              | 动作   | 内容                                                                 |
| ------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `packages/logger/**`                              | 新增   | 本设计的功能包                                                       |
| `apps/services/src/app.ts`                        | 改     | 去掉 pino 配置，改 `loggerInstance`；删除 logDir 推导（移交 sink）   |
| `apps/services/src/server.ts`                     | 改     | spawn/drain/降级编排；删掉 `logger.flush` 强转 + 2s race             |
| `apps/services/src/core/env.ts`                   | 改     | 新增第 12 节的环境变量                                               |
| `apps/services/src/core/paths.ts`                 | 新增   | `findPackageRoot()`（替代 app.ts 里的包根推导）                      |
| `apps/services/src/core/access-log-transport.mjs` | **删** | 逻辑迁入 `packages/logger/src/writer.ts`                             |
| `apps/services/src/utils/index.ts`                | **删** | 只剩 `formatLogTime()`，迁入 `packages/logger/src/time.ts`；文件变空 |
| `apps/services/src/plugins/logger.ts`             | 不改   | 继续用 `fastify.log.info`（facade 兼容）                             |
| `apps/services/src/core/error-handler.ts`         | 不改   | 继续用 `request.log.warn/error`                                      |
| `apps/services/scripts/build.ts`                  | 改     | 新增 vendor logger 步骤；删除 `copyRuntimeFiles()`                   |
| `apps/services/package.json`                      | 改     | 增加 `@repo/logger`；移除 `pino`、`pino-abstract-transport`          |
| `apps/services/.env.example`                      | 改     | 新增日志配置项                                                       |
| `apps/services/README.md`                         | 改     | 重写"日志"章节（文件位置、轮转、保留、查看、故障语义）               |
| `pnpm-workspace.yaml` / `turbo.json`              | 不改   | `apps/*` + `packages/*` 已覆盖；`dev` 已 `dependsOn ^build`          |

---

## 15. 决策记录（已确认）

| #   | 决策           | 最终值                                    | 备选                    | 影响                                 |
| --- | -------------- | ----------------------------------------- | ----------------------- | ------------------------------------ |
| D1  | 包位置         | `packages/logger`                         | `apps/logger`           | 命名语义；`apps/` 更像独立部署服务   |
| D2  | `time` 精度    | 保持秒级（兼容历史）+ 新增 `ts` epoch ms  | 加毫秒 `HH:mm:ss.SSS`   | 秒级够用；毫秒会与历史文件格式不一致 |
| D3  | 单文件上限     | **默认 10MB**（`LOG_MAX_FILE_MB=10`）     | 关闭 / 100MB            | 按用户要求：可配置、默认 10、单位 MB |
| D4  | 保留语义       | 含今天共 30 个日历日（`cutoff=today-29`） | 不含今天 30 天          | 边界相差 1 天                        |
| D5  | 超期文件       | 直接删除                                  | 先 gzip 再删（省 80%+） | 压缩留给 P4                          |
| D6  | 降级策略       | 主进程 `direct` 直写（同代码）            | 只打 stderr             | `direct` 不丢日志，但主进程承担 IO   |
| D7  | 查看通道优先级 | 先 CLI（P2），admin 后台放 P4             | 直接上 admin            | admin 需要权限/分页/SSE，工作量更大  |

---

## 16. 分期与验收

| 期  | 范围                                                      | 交付物                                       | 可回滚点                       |
| --- | --------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| P0  | 契约 + facade + `child()` + 序列化/脱敏 + 单测            | `packages/logger/src/{logger,types,time}.ts` | 未接线（`LOG_MODE=off`）       |
| P1  | writer + retention + 子进程 + sink/spawn/降级 + dist 打包 | 主服务可切换 `LOG_MODE=child`                | `LOG_MODE=direct` 回退主进程写 |
| P2  | CLI（`ls/cat/tail`）+ `stats` 挂 `/health`                | 运维可用                                     | 独立命令，不影响服务           |
| P3  | 删除 pino 代码路径、更新 README/`.env.example`            | 收尾                                         | `git revert`                   |
| P4  | 可选：admin 日志查看（权限/分页/SSE）、gzip               | 增强                                         | 独立特性                       |

> 落地情况：P0/P1/P2/P3 曾完整实现并验证通过，随后整体回滚（见文首状态）。
> `stats` 当时通过 `sink.stats()` 暴露，**尚未**挂到 `/health` 路由（P2 的剩余项）。

**完成定义（DoD）**：

1. `pnpm typecheck` / `pnpm format:check` 全绿
2. 单条日志 661B ≤ 6 µs；1MB body ≤ 900 µs（对照 pino 4.61 µs / 734 µs）
3. 1000 rps × 60s：行数可对账、`dropped=0`、主进程 RSS 稳定
4. `Stop-Process -Force` 杀主进程 → 子进程 ≤ 1s 自退
5. `kill` 子进程 → 主服务不崩、`degraded` + 自动拉起
6. `LOG_DIR` 指到只读目录 → 主服务正常响应，stderr 有明确报错
7. 保留策略：造 40 天假文件，跑一次只删 30 天前的，边界日（第 30/31 天）正确
8. `tail --follow` 跨天不中断，10 万行不丢不重
9. `dist` 单目录拷到干净机器，`node dist/server.js` 能拉起子进程
10. `node dist/vendor/logger/dist/cli.js tail` 在**不启动主服务**的情况下可用

### 16.1 实施记录（踩到的四个坑，重做时先看这里）

| 现象                                                       | 根因                                                                                                 | 修复                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 多条日志在文件里粘成一行，且全落进 `log/` 目录             | facade 产出的行**不带结尾换行**（`direct` 模式由 writer 补），走管道时以为子进程 readline 会自己分段 | `sink.ts` 加 `frame(line) = line + "\n"`，管道侧统一补换行                  |
| 单文件超过上限不切分                                       | 用 `stream.bytesWritten` 判断大小，而它在数据真正写进 fd 前一直是 0（`createWriteStream` 是异步的）  | 改成自己的 `entry.size` 计数（`Buffer.byteLength`），打开时按 `stat` 初始化 |
| 启动即报 `FST_ERR_LOG_LOGGER_AND_LOGGER_INSTANCE_PROVIDED` | `logger` 与 `loggerInstance` 互斥                                                                    | 只传 `loggerInstance`，不传 `logger`                                        |
| `registerResponse(app)` 类型不兼容                         | 从 `loggerInstance` 推断出 `RepoLogger`，与本包 `types/fastify.d.ts` 的默认泛型增强不匹配            | 显式 `const fastifyLogger: FastifyBaseLogger = options.logger`              |

另外一条：Fastify 内部会调 `loggerInstance.child({}, 整个 Fastify 选项对象)`，所以 `child()` 的第二参数
不能按 `ChildLoggerOptions` 严格校验，只能认 `level` 字符串。

### 16.2 验证记录（回滚前实测通过）

| 验证项                         | 结果                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| 单测（`node:test`，15 个用例） | 全绿：级别过滤 / 脱敏不改入参 / child 绑定 / Error 展开 / 分卷 / 保留边界 / 500 行无半行 |
| 全仓 `pnpm typecheck`（turbo） | 4 包全绿                                                                                 |
| 真实服务联调                   | 新格式带 `ts`/`pid`，`router/` 与 `log/` 分流正确，`authorization` 已脱敏                |
| 保留边界                       | 第 30 天文件被删、第 29 天保留、非日志文件不动                                           |
| 子进程崩溃                     | 第 1 次自动拉起；超过上限后 `degraded` 直写，日志仍落盘                                  |
| 强杀父进程                     | 2.5s 内子进程自退，无孤儿，18 行已落盘                                                   |
| 打包                           | `dist/vendor/logger/` 生成、`file:` 依赖正确、`dist` 内无 pino 残留、打包后 CLI 可直跑   |

**未验证**（重做时仍需补）：1000 rps 压测、只读目录、`tail --follow` 跨天、10 万行 tail、
干净机器 `npm install --omit=dev` 后的完整启动。

---

## 17. 测试计划

| 层   | 对象            | 用例                                                                                        |
| ---- | --------------- | ------------------------------------------------------------------------------------------- |
| 单测 | `time.ts`       | 跨月/跨年/闰年（2-29）日期计算；本地时区与 `TZ` 变化                                        |
| 单测 | `retention.ts`  | cutoff 边界（第 29/30/31 天）；非法文件名不删；目录不存在不报错；删除失败只 warn；单次上限  |
| 单测 | `logger.ts`     | 级别过滤；`child()` 绑定合并不泄漏父级；`Error` 序列化；脱敏；`%` 不格式化；`silent()` 无效 |
| 单测 | `writer.ts`     | 跨天切换 `end()` 旧流；懒创建（无日志不建文件）；背压 pause/resume；写失败不抛              |
| 单测 | `sink.ts`       | 队列水位丢弃顺序（先 info 后 error）；EPIPE 不抛；重启退避次数与上限                        |
| 集成 | 主↔子           | spawn → ready → 10k 行 → 行数与文件一致；`end()` 后无残留行                                 |
| 集成 | 故障注入        | 杀子进程 / 杀主进程 / 只读目录 / ENOSPC（注入 fake stream）/ 管道提前关闭                   |
| 集成 | dev 模式        | `node --watch` 重启后不残留旧子进程                                                         |
| 性能 | 基准            | 661B 单条、1MB body、1000 rps 持续 60s、RSS 抖动                                            |
| 查看 | `viewer.ts`/CLI | `tail` 跨天切换、`--level`/`--grep`、大文件分页、`--follow` 中断恢复                        |

---

## 18. 风险

| #   | 风险                                   | 影响                      | 对策                                                                  |
| --- | -------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| 1   | 自研 facade 与 Fastify 契约不完全兼容  | 启动失败或 `req.log` 报错 | P0 先用最小 Fastify 实例跑通；`loggerInstance` + `LogController` 验证 |
| 2   | EPIPE / 未捕获异常打挂主服务（最高危） | 服务不可用                | 不变量 1、2 + 故障注入测试                                            |
| 3   | 子进程成为僵尸                         | 资源泄漏                  | stdin EOF 必退 + 父 PID 探活 + 强杀实测（Windows）                    |
| 4   | 打包后路径解析错（dev/prod 分叉）      | 生产不记日志              | `require.resolve` + 多级兜底；解析失败即 `degraded` + 启动报错        |
| 5   | 慢盘导致内存涨                         | OOM                       | 端到端背压 + 有界队列 + 水位丢弃                                      |
| 6   | 保留策略误删                           | 事故                      | 严格正则 + 只认文件名日期 + 单次上限 + 干跑日志                       |
| 7   | 自研实现的性能隐患（每请求 `child()`） | p99 劣化                  | O(1) `child()` + 基准测试作为 DoD                                     |
| 8   | 双实例写同一目录                       | 日志交错                  | 文档约束；后续可按实例分目录                                          |
| 9   | 迁移期新旧实现并存                     | 日志翻倍                  | 不保留 pino 双写；用 `LOG_MODE=direct` 验证 facade，再切 `child`      |

---

## 附录 A：IPC 控制面协议

```ts
// 协议版本随包版本走；不匹配即报错退出
const PROTOCOL_VERSION = 1;

// 主 → 子
type ParentMessage =
  | { v: 1; type: "ping" }
  | { v: 1; type: "stats" }
  | { v: 1; type: "rotate" } // 手动切分（调试用）
  | { v: 1; type: "drain" }; // 请求 flush 并回执

// 子 → 主
type ChildMessage =
  | { v: 1; type: "ready"; pid: number }
  | {
      v: 1;
      type: "stats";
      written: number;
      failedWrites: number;
      files: string[];
      retention: { ranAt: number; removed: number; skipped: number; cutoff: string } | null;
    }
  | { v: 1; type: "drained" }
  | { v: 1; type: "error"; code: "ENOSPC" | "EACCES" | "EPIPE" | "OTHER"; message: string }
  | { v: 1; type: "bye"; written: number; failedWrites: number };
```

数据面与控制面严格分离：**日志行只走 stdin，控制消息只走 IPC**，互不混入。

## 附录 B：与 pino 实现的行为差异

| 方面       | pino + transport（现状）                           | `@repo/logger`（本设计）                           |
| ---------- | -------------------------------------------------- | -------------------------------------------------- |
| 记录创建   | pino（主线程序列化）                               | 自研 facade（主线程序列化），行为等价              |
| 跨边界缓冲 | 4MB SharedArrayBuffer + worker 线程                | OS 管道 + 有界内存队列（子进程）                   |
| 缓冲满时   | `Atomics.wait` **同步阻塞主线程**（≤10s）          | 丢弃 + 计数（**永不阻塞**）                        |
| 背压       | transport 忽略 `write()` 返回值                    | 端到端 pause/resume + 水位丢弃                     |
| 磁盘满     | worker 内未捕获异常，**静默死亡**                  | 报 `ENOSPC`、继续消费、丢弃并计数                  |
| 退出       | `process.on("exit")` 里 `flushSync` + `sleep(100)` | 排空队列 → `stdin.end()` → 等子进程退出（3s 超时） |
| 保留策略   | 无                                                 | 30 个日历日，按文件名日期清理                      |
| 实时查看   | 无                                                 | CLI `tail --follow`（跨天自动切换）                |
| 运行时依赖 | pino + pino-abstract-transport                     | **0**                                              |
| 打包       | 拷单个 `.mjs`                                      | 拷 `dist/vendor/logger/` 目录                      |

## 附录 C：命名与目录约定

- 包名 `@repo/logger`；源码 `packages/logger/src/*.ts`；产物 `dist/*.js`
- 日志文件：`logs/<router|log>/YYYY-MM-DD.log`（历史命名，不变）
- 单文件超过 `LOG_MAX_FILE_MB`（默认 10MB）时切分：`YYYY-MM-DD.<序号>.log`
- 环境变量统一 `LOG_` 前缀；子进程参数统一 `--kebab-case`
- 主服务侧入口统一 `apps/services/src/server.ts`（sink 生命周期只在那里编排）

---

## 19. 最终实现（as-built）

本节是**实际落地版本**，与第 1–18 节冲突时以此为准。

### 19.1 与前面章节的差异

| 项          | 原设计（§1–18）                   | 最终实现                                                               |
| ----------- | --------------------------------- | ---------------------------------------------------------------------- |
| 脱敏位置    | 主进程（facade 内）               | **子进程**（`redact.ts`），主进程只发原始字节                          |
| 降级        | 子进程反复崩溃 → 降级为主进程直写 | **不降级**：退避重启，5s 封顶后永久每 5s 重试                          |
| `time` 字段 | 主进程格式化                      | **子进程**从 `ts` 生成（主进程连 `Date` 都不建）                       |
| 目录布局    | 固定 `logs/{router,log}`          | 支持 `LOG_SERVICE` → `logs/<service>/{router,log}`（不设则沿用旧布局） |
| 复用面      | 只服务本仓库                      | 新增 `config.ts` / `setup.ts`，任意微服务一行接入，可 `npm pack` 发布  |
| 打包        | `dist/logger/` 裸目录             | `dist/vendor/logger/` + `file:` 依赖（与 `@repo/shared` 同机制）       |

### 19.2 模块划分（提取出来的公共件）

```
packages/logger/src/
├── index.ts           公开入口（只导出 API，内部模块不外露）
├── setup.ts           一行接入：setupLogger() → { logger, sink, config, shutdown }
├── config.ts          配置解析（LOG_* / envPrefix / service）+ 目录推导 + 净化上限
├── logger.ts          facade：判级 / level+ts / 序列化 / child()
├── sanitize.ts        主进程净化（Buffer/流/base64/超长/节点上限）
├── redact.ts          子进程脱敏
├── transform.ts       子进程：解析 → 脱敏 → 补 time → 路由判定（可单测）
├── sink.ts            队列 + 状态机 + 重启（无降级）
├── child-process.ts   子进程启动细节（args / env / 入口解析 / 换行 framing）
├── child-main.ts      子进程入口（stdin / retention / IPC / 退出）
├── writer.ts          按天 + 按大小切分、背压
├── retention.ts       30 个日历日清理
├── file-read.ts       读文件底层（读行 / 末尾 N 行 / 增量）
├── line.ts            行头探测（level / ts / logType）+ 行过滤
├── level.ts           级别判断与比较
├── object.ts          isRecord / jsonInner
├── async.ts           onceWithTimeout
└── time.ts / types.ts / protocol.ts / viewer.ts / cli.ts / off-sink.ts
```

提取原则：**同一份逻辑只留一处**（级别表、行头正则、readline 样板、目录映射、超时收尾、JSON 去花括号、对象判断、env 数字解析）。内部模块不进 `exports`，不影响打包面。

### 19.3 数据流（最终）

```
主进程: 判级 → Date.now() → 拼 {"level":…,"ts":…,<bindings>,<payload>,"msg":…} → sink（有界队列） → 子进程 stdin
子进程: readline → JSON.parse → 脱敏 → 补 time（字段序 level/time/ts/…）→ 选目录 → 落盘 → 背压 pause/resume
```

主线程每请求只剩：级别比较 + `Date.now()` + 一次 `JSON.stringify`（业务字段）+ 一次 `write`。

### 19.4 最终配置项

| 变量                     | 默认         | 说明                                                  |
| ------------------------ | ------------ | ----------------------------------------------------- |
| `LOG_SERVICE`            | 空           | 服务名；写进每条日志，并决定 `logs/<service>/` 子目录 |
| `LOG_DIR`                | `logs`       | 相对路径按包根解析                                    |
| `LOG_LEVEL`              | `info`       | 主进程唯一必须的开关（过滤发生在序列化前）            |
| `LOG_MODE`               | `child`      | `child` / `off`（**没有 direct**）                    |
| `LOG_RETENTION_DAYS`     | `30`         | 含今天；`0` = 不清理                                  |
| `LOG_MAX_FILE_MB`        | `10`         | 超过切 `YYYY-MM-DD.N.log`；`0` = 不切分               |
| `LOG_BODY_MAX_BYTES`     | `16384`      | 主进程净化：单字符串上限，超了记摘要                  |
| `LOG_BODY_MAX_NODES`     | `2000`       | 主进程净化：节点数上限，超了整个 body 记摘要          |
| `LOG_REDACT_PATHS`       | 空           | 追加脱敏路径（子进程执行）                            |
| `LOG_REDACT_CENSOR`      | `[Redacted]` | 替换值                                                |
| `LOG_SINK_MAX_BUFFER_MB` | `4`          | 队列水位，超了按级别丢                                |
| `LOG_STDOUT`             | `false`      | 同时打到 stdout                                       |

`LOG_*` **不在** `apps/services/src/core/env.ts` 的 zod schema 里——由 `loadLogConfig` 解析，非法值回落默认。

### 19.5 请求日志：三段式 + 插件顺序

| 位置                                  | 干什么                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `plugins/logger.ts` → `onRequest`     | 只把 method/url/ip/headers/query/params/requestId 缓存到 WeakMap，**不写日志**                                    |
| `plugins/logger.ts` → `preValidation` | 写**唯一一条**请求日志（body/files 已就绪，且仍在 zod 校验与 jwt preHandler 之前，所以 400/401/403 也记）         |
| `core/error-handler.ts`               | `writeRequestLog` 幂等兜底：404、multipart 解析失败（`FST_REQ_FILE_TOO_LARGE` 等）补一条带 `bodyError` 的请求日志 |

**顺序靠 autoload 的依赖声明，不靠文件名**：

```ts
export default fp(requestLogPlugin, { name: "request-log", dependencies: ["multipart"] });
```

（`@fastify/autoload@6.5.1` 没有 `order`/`priority` 选项，`dependencies` 是官方排序机制，依赖缺失会直接报错。）

### 19.6 multipart：记字段 + 文件元信息，不记内容

```ts
attachFieldsToBody: true,
async onFile(part) {           // 必须是普通函数：this 是 request
  let bytes = 0;
  for await (const chunk of part.file) bytes += chunk.length;   // 流式计数后丢弃
  addFileMeta(this, { fieldname, filename, mimetype, encoding, bytes });
}
```

落盘形态：

```json
{
  "body": { "name": "demo", "category": "finance" },
  "files": [{ "fieldname": "file", "filename": "small.bin", "mimetype": "application/octet-stream", "bytes": 1024 }]
}
```

**踩到的坑**：配了 `onFile` 之后，**文件条目仍然留在 `request.body` 里**（实测），必须在 `extractMultipartFields` 里按 `type === "file"` 跳过，否则文件对象会被当普通字段记进 body。

### 19.7 验证记录（本轮实测）

| 验证项                                                                                      | 结果                                                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 单测 19 个用例（time/config/facade/sanitize/line/redact/transform/writer/retention/viewer） | 全绿                                                                            |
| 全仓 `pnpm typecheck`（turbo，4 包）                                                        | 6/6 成功                                                                        |
| 冒烟：JSON POST                                                                             | `body: {username, password}`，且 `password` → `[Redacted]`                      |
| 冒烟：multipart（2 字段 + 1KB 文件）                                                        | `body: {name, category}`、`files: small.bin/1024B`、**body 里没有文件**         |
| 冒烟：超限文件（8KB > 2KB 限制）                                                            | 413，请求日志带 `bodyError: FST_REQ_FILE_TOO_LARGE`，`files` 记到限流前的 2048B |
| 冒烟：带 Bearer/Cookie 的 401 请求                                                          | `authorization` / `cookie` 均落成 `[Redacted]`，证明脱敏在子进程生效            |
| 文件内容泄漏检查                                                                            | 日志里无 `"data":[`（Buffer 未展开）✓                                           |
| 优雅退出（同进程 emit SIGTERM）                                                             | 最后一条「收到退出信号」已落盘，子进程无残留                                    |
| 打包                                                                                        | `dist/vendor/logger/` 生成、`dist` 内无 pino 残留、services 依赖里 pino 已移除  |

**未验证/需注意**：

- Windows 上 `process.kill(pid, "SIGTERM")` 是硬终止，真实的 Ctrl+C 信号路径需手工确认一次；
- 1000 rps 压测、只读目录、跨天 tail、干净机器 `npm install --omit=dev` 仍未做；
- `.env` 里不能用 `//` 注释（Node `--env-file` 只认 `#`；`REDIS_URL=… // 说明` 会让 ioredis 抛 `Invalid URL`）。

### 19.8 复用到其他微服务

```ts
import { setupLogger } from "@repo/logger";

const { logger, config, shutdown } = setupLogger({ service: "order", baseDir: process.cwd() });
// logger.info({ logType: "app" }, "订单服务启动");
// 退出时 shutdown()
```

- 配置全走 `LOG_*`；同机多服务可用 `envPrefix: "ORDER_LOG_"` 各配各的；
- 包零运行时依赖，`npm pack` 后可直接装进其他仓库；
- 库本身不含框架代码；请求日志钩子（`core/request-log.ts`）按服务各自复制或后续抽成 `@repo/logger/fastify`。
