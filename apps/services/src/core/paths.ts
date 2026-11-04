import { existsSync } from "node:fs";
import path from "node:path";

export function findPackageRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    if (existsSync(path.join(current, "package.json"))) return current;

    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}
