/**
 * 保留策略：只留最近 N 个日历日。
 *
 * 每条规则都对应一次踩坑：
 * 1) 按**文件名里的日期**判断，不用 mtime（会被 rsync/拷贝/镜像重打戳）；
 * 2) 用**字典序字符串比较**，不算 Date 差值（跨月/跨年/闰年天然正确，时钟回拨也不误删）；
 * 3) 严格正则匹配才进候选，其它文件一律不动；
 * 4) 删除失败只 warn 不抛（Windows 上被占用会 EBUSY）；
 * 5) 单次删除有上限，防止参数写错把历史一次清空；
 * 6) 只扫自己这棵子树（多服务共用一个 LOG_DIR 时不会互删）。
 */
import type { Dirent } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { dirFor, type LogDirs } from "./config.js";
import { shiftDays, ymd } from "./time.js";
import type { LogDirKey } from "./types.js";

const LOG_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:\.\d+)?\.log(?:\.gz)?$/;
const LOG_DIR_KEYS: readonly LogDirKey[] = ["router", "log"];

export interface RetentionOptions {
  dirs: LogDirs;
  /** 保留天数（含今天）；<= 0 表示不清理 */
  days: number;
  maxDeletePerRun?: number;
  onWarn?: (message: string) => void;
}

export interface RetentionResult {
  ranAt: number;
  removed: number;
  skipped: number;
  cutoff: string;
  deleted: string[];
}

export async function runRetention(options: RetentionOptions): Promise<RetentionResult> {
  const { dirs, days, maxDeletePerRun = 200, onWarn } = options;
  const result: RetentionResult = {
    ranAt: Date.now(),
    removed: 0,
    skipped: 0,
    cutoff: ymd(shiftDays(new Date(), -(Math.max(days, 1) - 1))),
    deleted: [],
  };

  if (!Number.isFinite(days) || days <= 0) return result;

  for (const dirKey of LOG_DIR_KEYS) {
    const dir = dirFor(dirs, dirKey);

    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !LOG_FILE_PATTERN.test(entry.name)) {
        result.skipped++;
        continue;
      }
      if (entry.name.slice(0, 10) >= result.cutoff) continue;

      if (result.removed >= maxDeletePerRun) {
        result.skipped++;
        continue;
      }

      try {
        await rm(path.join(dir, entry.name), { force: true });
        result.removed++;
        result.deleted.push(`${dirKey}/${entry.name}`);
      } catch (error) {
        result.skipped++;
        onWarn?.(`清理旧日志失败 ${dirKey}/${entry.name}：${(error as Error).message}`);
      }
    }
  }

  return result;
}
