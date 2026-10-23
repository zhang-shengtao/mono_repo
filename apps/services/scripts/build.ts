/// <reference types="node" />
import { spawn } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vendorWorkspaceDependencies } from "./workspace-vendor.ts";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(currentFilePath);
const rootDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(rootDir, "..", "..");
const distDir = path.resolve(rootDir, "dist");

interface PackageJson {
  name?: string;
  version?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
}

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

  console.log("[build] write drizzle config");
  await writeDrizzleConfig();


  console.log("[build] vendor workspace dependencies");
  const dependencies = await vendorWorkspaceDependencies({ rootDir, distDir, repoDir });

  console.log("[build] write package.json");
  await writeDistPackageJson(dependencies);

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


async function writeDrizzleConfig() {
  const config = `import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required（drizzle-kit push 要连库做 schema diff）");
}

export default defineConfig({
  // dist 里只有编译后的 JS schema；db/script 在子目录里，不会被这个 glob 匹配到
  schema: "db/*.js",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
});
`;

  await writeFile(path.join(distDir, "drizzle.config.mjs"), config, "utf8");
}

async function writeDistPackageJson(dependencies: Record<string, string>) {
  const packageJson = await readJson<PackageJson>(path.join(rootDir, "package.json"));
  const distPackage = {
    name: packageJson.name,
    version: packageJson.version,
    private: true,
    type: "module",
    engines: packageJson.engines,
    scripts: {
      prestart: "npm run db:push && npm run db:seed:permissions",
      start: "node --env-file-if-exists=.env server.js",
      "db:push": "node --env-file-if-exists=.env db/script/push-db.js",
      "db:push:force": "node --env-file-if-exists=.env db/script/push-db.js --force",
      "db:seed:permissions": "node --env-file-if-exists=.env db/script/permissions.js",
      "db:seed:admin": "node --env-file-if-exists=.env db/script/admin-user.js",
    },
    dependencies,
  };

  await writeFile(path.join(distDir, "package.json"), `${JSON.stringify(distPackage, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}
