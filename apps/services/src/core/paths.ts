import { existsSync } from "node:fs";
import path from "node:path";

/**
 * 向上找到第一个含 package.json 的目录，作为「包根」。
 *
 * 为什么不用固定层级：
 * - dev 跑 src/server.ts，包根是 apps/services；
 * - 仓库内跑 dist/server.js，包根还是 apps/services；
 * - dist 被单独拷到服务器当部署目录时，包根是那个部署目录本身。
 * 三种情况下 package.json 都在同一层，按「找文件」比按「层级数」可靠。
 */
export function findPackageRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    if (existsSync(path.join(current, "package.json"))) return current;

    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}
