/** 子进程启动细节从 sink 里抽出来：sink 只管队列与状态机 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROTOCOL_VERSION } from "./protocol.js";

/** 只透传必要系统变量，绝不把 DATABASE_URL / JWT 密钥带给子进程 */
const FORWARDED_ENV_KEYS = ["SystemRoot", "windir", "SystemDrive", "TEMP", "TMP", "PATH", "PATHEXT"];

export interface ChildLaunchOptions {
  logDir: string;
  service?: string;
  retentionDays: number;
  maxFileMb: number;
  redactPaths?: string;
  redactCensor?: string;
  timezone: string;
}

/** 数据面是 NDJSON：facade 产出的行不带换行，管道侧统一补 */
export function frameLine(line: string): string {
  return `${line}\n`;
}

export function buildChildArgs(entry: string, options: ChildLaunchOptions): string[] {
  const args = [
    entry,
    "--protocol",
    String(PROTOCOL_VERSION),
    "--log-dir",
    options.logDir,
    "--retention-days",
    String(options.retentionDays),
    "--max-file-mb",
    String(options.maxFileMb),
    "--timezone",
    options.timezone,
    "--parent-pid",
    String(process.pid),
  ];
  if (options.service) args.push("--service", options.service);
  if (options.redactPaths) args.push("--redact-paths", options.redactPaths);
  if (options.redactCensor) args.push("--redact-censor", options.redactCensor);
  return args;
}

export function buildChildEnv(timezone: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { TZ: timezone };
  for (const key of FORWARDED_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export function resolveChildEntry(explicit?: string): string | null {
  if (explicit) {
    const absolute = path.resolve(explicit);
    if (existsSync(absolute)) return absolute;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [];

  try {
    const require = createRequire(import.meta.url);
    candidates.push(path.join(path.dirname(require.resolve("@repo/logger")), "child-main.js"));
  } catch {}

  candidates.push(path.join(here, "child-main.js"));
  candidates.push(path.join(here, "..", "dist", "child-main.js"));
  candidates.push(path.join(here, "..", "logger", "child-main.js"));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
