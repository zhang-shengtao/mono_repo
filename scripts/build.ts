/// <reference types="node" />
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(currentFilePath);
const rootDir = path.resolve(scriptDir, "..");
const distDir = path.resolve(rootDir, "dist");

await main();

async function main() {
  console.log("[build] clean dist");
  await cleanDist();

  console.log("[build] compile typescript");
  await runLocalBin("tsc", ["-p", "tsconfig.json"]);

  console.log("[build] rewrite aliases");
  await runLocalBin("tsc-alias", ["-p", "tsconfig.json", "--resolve-full-paths", "--resolve-full-extension", ".js"]);

  console.log("[build] clean source maps");
  await removeSourceMaps(distDir);

  console.log("[build] copy runtime files");
  await copyRuntimeFiles();

  console.log("[build] done");
}

async function cleanDist() {
  if (path.basename(distDir) !== "dist") {
    throw new Error(`Refusing to delete non-dist directory: ${distDir}`);
  }

  const relativePath = path.relative(rootDir, distDir);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to delete directory outside project root: ${distDir}`);
  }

  await rm(distDir, { recursive: true, force: true });
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

async function removeSourceMaps(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await removeSourceMaps(entryPath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith(".map")) {
        await rm(entryPath, { force: true });
      }
    }),
  );
}

async function copyRuntimeFiles() {
  await mkdir(distDir, { recursive: true });
  await copyRequiredFile("package.json");
  await copyRequiredFile(
    path.join("src", "core", "access-log-transport.mjs"),
    path.join("core", "access-log-transport.mjs"),
  );
  await copyEnvFiles();
}

async function copyRequiredFile(sourcePath: string, targetPath = sourcePath) {
  const targetFilePath = path.join(distDir, targetPath);
  await mkdir(path.dirname(targetFilePath), { recursive: true });
  await copyFile(path.join(rootDir, sourcePath), targetFilePath);
}

async function copyEnvFiles() {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const envFiles = entries.filter((entry) => entry.isFile() && entry.name.startsWith(".env"));

  await Promise.all(envFiles.map((entry) => copyFile(path.join(rootDir, entry.name), path.join(distDir, entry.name))));
}
