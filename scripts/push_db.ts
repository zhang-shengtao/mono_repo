/// <reference types="node" />

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), "..");

export default defineConfig({
  schema: "src/db/*.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.MYSQL_URL ?? "",
  },
});

if (isDirectRun()) {
  runLocalBin("drizzle-kit", ["push", "--config", currentFilePath]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

function isDirectRun() {
  return process.argv[1] ? path.resolve(process.argv[1]) === currentFilePath : false;
}

async function runLocalBin(command: string, args: string[]) {
  const executable = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${command}.cmd` : command,
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
