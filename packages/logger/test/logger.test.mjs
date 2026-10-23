/**
 * 单元测试（零依赖，node:test）。跑之前先 `tsc` 产出 dist。
 *   pnpm --filter @repo/logger test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLogger } from "../dist/logger.js";
import { sanitize } from "../dist/sanitize.js";
import { createRedactor } from "../dist/redact.js";
import { createRecordTransform } from "../dist/transform.js";
import { peekHeader, matchLine } from "../dist/line.js";
import { LogWriter } from "../dist/writer.js";
import { runRetention } from "../dist/retention.js";
import { loadLogConfig, resolveLogDirs, resolveSanitizeLimits } from "../dist/config.js";
import { dayOfEpoch, formatLogTime, shiftDays, ymd } from "../dist/time.js";
import { listLogFiles, readLogLines, tailLog, viewerOptions } from "../dist/viewer.js";

async function tempDir() {
  return mkdtemp(path.join(tmpdir(), "repo-logger-"));
}

function captureSink() {
  const lines = [];
  return {
    lines,
    sink: {
      write(line) {
        lines.push(line);
      },
      flush(cb) {
        cb?.();
      },
      end(cb) {
        cb?.();
      },
      stats: () => ({ mode: "off", state: "stopped", written: lines.length, dropped: 0, restarts: 0 }),
    },
  };
}

test("shiftDays 跨月 / 跨年 / 闰年", () => {
  assert.equal(ymd(shiftDays(new Date(2026, 0, 31), 1)), "2026-02-01");
  assert.equal(ymd(shiftDays(new Date(2026, 11, 31), 1)), "2027-01-01");
  assert.equal(ymd(shiftDays(new Date(2024, 1, 28), 1)), "2024-02-29");
  assert.equal(ymd(shiftDays(new Date(2026, 2, 1), -1)), "2026-02-28");
});

test("formatLogTime / dayOfEpoch 与历史格式一致", () => {
  const date = new Date(2026, 9, 22, 9, 5, 3);
  assert.equal(formatLogTime(date), "2026-10-22 09:05:03");
  assert.equal(dayOfEpoch(date.getTime()), "2026-10-22");
});

test("loadLogConfig：默认值、service 目录分层、env 前缀、MODE=off", () => {
  const base = loadLogConfig({}, { service: "order", baseDir: "/srv/order" });
  assert.equal(base.mode, "child");
  assert.equal(base.level, "info");
  assert.equal(base.retentionDays, 30);
  assert.equal(base.maxFileMb, 10);
  assert.equal(base.bodyMaxBytes, 16 * 1024);
  assert.equal(base.logDir, path.join("/srv/order", "logs"));
  assert.deepEqual(resolveLogDirs(base).router, path.join("/srv/order", "logs", "order", "router"));

  const custom = loadLogConfig(
    { ORDER_LOG_MODE: "off", ORDER_LOG_LEVEL: "debug", ORDER_LOG_RETENTION_DAYS: "7", ORDER_LOG_MAX_FILE_MB: "1" },
    { service: "order", envPrefix: "ORDER_LOG_", baseDir: "/srv/order" },
  );
  assert.equal(custom.mode, "off");
  assert.equal(custom.level, "debug");
  assert.equal(custom.retentionDays, 7);
  assert.equal(custom.maxFileMb, 1);

  assert.deepEqual(resolveLogDirs({ logDir: "/logs", service: undefined }).router, path.join("/logs", "router"));

  assert.deepEqual(resolveSanitizeLimits({ LOG_BODY_MAX_BYTES: "2048" }), { maxStringBytes: 2048, maxNodes: 2000 });
});

test("级别过滤：低于当前 level 不产生输出", () => {
  const { lines, sink } = captureSink();
  const logger = createLogger({ level: "info", sink });
  logger.debug("dropped");
  logger.info("kept");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /"msg":"kept"/);
});

test("facade 只发 ts，不发 time（time 由子进程生成）", () => {
  const { lines, sink } = captureSink();
  const logger = createLogger({ level: "info", sink, base: { service: "order" }, now: () => 1792718257385 });
  logger.info({ logType: "app" }, "hello");

  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.ts, 1792718257385);
  assert.equal(parsed.service, "order");
  assert.equal(parsed.time, undefined);
  assert.equal(parsed.level, "info");
});

test("child 绑定继承 base，并容忍 Fastify 传来的任意 options", () => {
  const { lines, sink } = captureSink();
  const logger = createLogger({ level: "info", sink, base: { service: "order" } });
  logger.child({ reqId: "abc" }, { logger: "unused", serializers: { req() {} } }).info("x");

  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.service, "order");
  assert.equal(parsed.reqId, "abc");
});

test("序列化失败 / sink 抛错都不外抛", () => {
  const circular = { name: "root" };
  circular.self = circular;
  const { sink } = captureSink();
  const logger = createLogger({ level: "info", sink });
  assert.doesNotThrow(() => logger.info(circular));

  const broken = createLogger({
    level: "info",
    sink: {
      ...sink,
      write() {
        throw new Error("down");
      },
    },
  });
  assert.doesNotThrow(() => broken.info("x"));
});

test("level 可运行时热改，isLevelEnabled 跟随", () => {
  const { lines, sink } = captureSink();
  const logger = createLogger({ level: "error", sink });
  logger.info("hidden");
  logger.level = "debug";
  logger.info("shown");
  assert.equal(lines.length, 1);
  assert.equal(logger.isLevelEnabled("debug"), true);
  logger.level = "silent";
  assert.equal(logger.isLevelEnabled("fatal"), false);
});

test("sanitize：Buffer / 流 / 超长字符串 / base64 都换成描述符", () => {
  const body = {
    name: "报表",
    file: Buffer.alloc(1024, 7),
    stream: { pipe() {} },
    big: "x".repeat(20 * 1024),
    inline: `data:image/png;base64,${"A".repeat(2048)}`,
  };
  const { value, truncated } = sanitize(body);

  assert.equal(value.name, "报表");
  assert.equal(value.file.__type, "buffer");
  assert.equal(value.file.bytes, 1024);
  assert.equal(value.stream.__type, "stream");
  assert.equal(value.big.__type, "string");
  assert.equal(value.inline.__type, "inline_base64");
  assert.equal(truncated, true);
  assert.equal(JSON.stringify(value).includes('"data":['), false);
});

test("sanitize：环形引用与节点上限都不抛", () => {
  const circular = { a: 1 };
  circular.self = circular;
  const capped = sanitize(circular, { maxDepth: 2 });
  assert.equal(typeof capped.value.a, "number");

  const wide = {};
  for (let i = 0; i < 5000; i++) wide[`k${i}`] = i;
  assert.equal(sanitize(wide, { maxNodes: 100 }).truncated, true);
});

test("peekHeader：正常命中；非法行回退不抛", () => {
  const line = JSON.stringify({ level: "info", ts: 1792718257385, service: "order", logType: "router", msg: "a" });
  assert.deepEqual(peekHeader(line), { ts: 1792718257385, dirKey: "router" });
  assert.deepEqual(peekHeader(JSON.stringify({ level: "info", ts: 1, msg: "x" })), { ts: 1, dirKey: "log" });
  assert.equal(typeof peekHeader("{oops").ts, "number");
});

test("matchLine：level 过滤 + grep", () => {
  const warn = JSON.stringify({ level: "warn", msg: "登录失败", url: "/admin/login" });
  const info = JSON.stringify({ level: "info", msg: "ok", url: "/admin/list" });

  assert.equal(matchLine(warn), true);
  assert.equal(matchLine(info, "warn"), false);
  assert.equal(matchLine(warn, "warn"), true);
  assert.equal(matchLine(warn, "error"), false);
  assert.equal(matchLine(warn, undefined, "登录"), true);
  assert.equal(matchLine(info, undefined, "登录"), false);
});

test("脱敏：命中路径换成 [Redacted]，不动其他字段", () => {
  const redact = createRedactor();
  const record = { headers: { authorization: "Bearer x", host: "h" }, body: { password: "p", user: "u" } };
  const result = redact(record);

  assert.equal(result.headers.authorization, "[Redacted]");
  assert.equal(result.headers.host, "h");
  assert.equal(result.body.password, "[Redacted]");
  assert.equal(result.body.user, "u");
  assert.equal(record.headers.authorization, "Bearer x");
});

test("transform：脱敏 + 从 ts 生成 time + 路由判定", () => {
  const transform = createRecordTransform({ now: () => 1792718257385 });
  const result = transform(
    JSON.stringify({
      level: "info",
      ts: 1792718257385,
      headers: { authorization: "Bearer x" },
      logType: "router",
      msg: "a",
    }),
  );

  assert.equal(result.dirKey, "router");
  assert.equal(result.ts, 1792718257385);

  const parsed = JSON.parse(result.line);
  assert.equal(parsed.time, formatLogTime(new Date(1792718257385)));
  assert.equal(parsed.headers.authorization, "[Redacted]");
  assert.deepEqual(Object.keys(parsed).slice(0, 3), ["level", "time", "ts"]);
  assert.equal(transform("{oops"), null);
});

test("writer：按 dirKey 分目录、按天切文件", async () => {
  const dir = await tempDir();
  const dirs = resolveLogDirs({ logDir: dir, service: undefined });
  const writer = new LogWriter({ dirs, maxFileMb: 0 });

  const day1 = new Date(2026, 9, 22, 23, 59, 59).getTime();
  const day2 = new Date(2026, 9, 23, 0, 0, 1).getTime();
  writer.write(JSON.stringify({ level: "info", ts: day1 }), { ts: day1, dirKey: "router" });
  writer.write(JSON.stringify({ level: "info", ts: day1 }), { ts: day1, dirKey: "log" });
  writer.write(JSON.stringify({ level: "info", ts: day2 }), { ts: day2, dirKey: "router" });
  await new Promise((resolve) => writer.close(resolve));

  assert.deepEqual((await readdir(dirs.router)).sort(), ["2026-10-22.log", "2026-10-23.log"]);
  assert.deepEqual(await readdir(dirs.log), ["2026-10-22.log"]);
  await rm(dir, { recursive: true, force: true });
});

test("writer：超过单文件上限切分序号", async () => {
  const dir = await tempDir();
  const dirs = resolveLogDirs({ logDir: dir, service: "order" });
  const writer = new LogWriter({ dirs, maxFileMb: 0.00005 });
  const ts = new Date(2026, 9, 22, 10, 0, 0).getTime();

  for (let index = 0; index < 5; index++) {
    writer.write(JSON.stringify({ level: "info", ts, pad: "x".repeat(20), index }), { ts, dirKey: "router" });
  }
  await new Promise((resolve) => writer.close(resolve));

  const files = (await readdir(dirs.router)).sort();
  assert.ok(files.length >= 2, `期望切分出多个文件，实际：${files.join(",")}`);
  await rm(dir, { recursive: true, force: true });
});

test("retention：保留最近 30 个日历日，非法文件名不动", async () => {
  const dir = await tempDir();
  const dirs = resolveLogDirs({ logDir: dir, service: "order" });
  await mkdir(dirs.router, { recursive: true });
  await mkdir(dirs.log, { recursive: true });

  const today = new Date();
  for (let offset = 0; offset < 40; offset++) {
    await writeFile(path.join(dirs.router, `${ymd(shiftDays(today, -offset))}.log`), "{}\n", "utf8");
  }
  await writeFile(path.join(dirs.router, "keep.txt"), "x", "utf8");
  await writeFile(path.join(dirs.log, "notes.md"), "x", "utf8");

  const result = await runRetention({ dirs, days: 30 });

  const expected = new Set();
  for (let offset = 0; offset < 30; offset++) expected.add(`${ymd(shiftDays(today, -offset))}.log`);
  expected.add("keep.txt");
  assert.deepEqual(new Set(await readdir(dirs.router)), expected);
  assert.equal(result.removed, 10);
  assert.equal(result.cutoff, ymd(shiftDays(today, -29)));
  assert.equal(existsSync(path.join(dirs.log, "notes.md")), true);
  await rm(dir, { recursive: true, force: true });
});

test("retention：days=0 不清理；目录不存在不报错", async () => {
  const dir = await tempDir();
  const dirs = resolveLogDirs({ logDir: dir, service: undefined });
  await mkdir(dirs.router, { recursive: true });
  await writeFile(path.join(dirs.router, "2020-01-01.log"), "{}\n", "utf8");

  assert.equal((await runRetention({ dirs, days: 0 })).removed, 0);
  assert.equal(existsSync(path.join(dirs.router, "2020-01-01.log")), true);
  assert.equal((await runRetention({ dirs: { ...dirs, router: path.join(dir, "nope") }, days: 30 })).removed, 0);
  await rm(dir, { recursive: true, force: true });
});

test("viewer：列表 / 读取 / level 过滤 / 末尾 N 行 / 无半行", async () => {
  const dir = await tempDir();
  const dirs = resolveLogDirs({ logDir: dir, service: "order" });
  const writer = new LogWriter({ dirs, maxFileMb: 10 });
  const ts = Date.now();
  const transform = createRecordTransform();

  for (let index = 0; index < 5; index++) {
    const line = JSON.stringify({ level: index >= 3 ? "warn" : "info", ts, logType: "router", index });
    const result = transform(line);
    writer.write(result.line, { ts: result.ts, dirKey: result.dirKey });
  }
  await new Promise((resolve) => writer.close(resolve));

  const viewer = viewerOptions(dir, "order");
  const files = await listLogFiles(viewer);
  assert.equal(files.length, 1);
  assert.equal(files[0].logType, "router");

  const all = [];
  for await (const line of readLogLines({ ...viewer, logType: "router", limit: 10 })) all.push(line);
  assert.equal(all.length, 5);

  const warns = [];
  for await (const line of readLogLines({ ...viewer, logType: "router", level: "warn", limit: 10 })) warns.push(line);
  assert.equal(warns.length, 2);

  const last = [];
  for await (const line of tailLog({ ...viewer, logType: "router", lines: 2 })) last.push(line);
  assert.equal(last.length, 2);

  const raw = await readFile(path.join(dirs.router, files[0].name), "utf8");
  for (const row of raw.split("\n").filter(Boolean)) assert.doesNotThrow(() => JSON.parse(row));

  await rm(dir, { recursive: true, force: true });
});
