/// <reference types="node" />
import { spawn } from "node:child_process";
import { access, copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(currentFilePath);
const rootDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(rootDir, "..", "..");
const distDir = path.resolve(rootDir, "dist");
const sharedDir = path.join(repoDir, "packages", "shared");

const SHARED_PACKAGE = "@repo/shared";
const SHARED_VENDOR_PATH = path.join(distDir, "vendor", "shared");
const SHARED_VENDOR_URL = "vendor/shared";

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

  console.log("[build] copy runtime files");
  await copyRuntimeFiles();

  console.log("[build] write drizzle config");
  await writeDrizzleConfig();

  console.log("[build] write package.json");
  const dependencies = await collectDependencies();
  await writeDistPackageJson(dependencies);

  console.log("[build] vendor @repo/shared");
  await vendorShared(dependencies);

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
  await copyRequiredFile(
    path.join("src", "core", "access-log-transport.mjs"),
    path.join("core", "access-log-transport.mjs"),
  );
}

/**
 * 给 dist 写一份 drizzle-kit 配置，让产物里也能跑 `drizzle-kit push`。
 *
 * 仓库侧的 drizzle.config.ts 指向 src/db/*.ts（TS 源码），dist 里没有这些文件，
 * 只有编译后的 db/*.js —— 所以 schema 要换成 db/*.js，其余（dialect / 连库方式）完全一致。
 * drizzle-kit 本身写在 dependencies 里，`npm install --omit=dev` 会一起装进 dist/node_modules。
 */
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
      /**
       * prestart 让「部署/重启」自动带上表结构同步：npm start 会先跑它，同步失败则不启动。
       * 只自动跑 db:push 和 permissions 种子（都是幂等的）；
       * admin 种子会重置密码，必须手动执行，绝不能放进自动流程。
       *
       * 注意：push 以 schema 为准反向覆盖库，删列/删表在终端里会让人确认；
       * 服务器上没有 TTY 时它会直接执行 —— 生产改结构前先在开发库或本地跑一遍看清清单。
       */
      prestart: "npm run db:push && npm run db:seed:permissions",
      start: "node --env-file-if-exists=.env server.js",
      /**
       * 部署侧的表结构同步入口，和开发侧的 `pnpm db:push` 是同一套机制：
       * 都是 drizzle-kit push —— 把 schema（dist 里是编译后的 db/*.js）和活库 diff 后直接执行 DDL。
       * 区别只有 config 和 env 文件前缀，所以「开发和部署同一种方式」是真的同一条命令。
       */
      "db:push": "node --env-file-if-exists=.env db/script/push-db.js",
      "db:push:force": "node --env-file-if-exists=.env db/script/push-db.js --force",
      "db:seed:permissions": "node --env-file-if-exists=.env db/script/permissions.js",
      "db:seed:admin": "node --env-file-if-exists=.env db/script/admin-user.js",
    },
    dependencies,
  };

  await writeFile(path.join(distDir, "package.json"), `${JSON.stringify(distPackage, null, 2)}\n`, "utf8");
}

async function collectDependencies() {
  const packageJson = await readJson<PackageJson>(path.join(rootDir, "package.json"));
  const declared = Object.keys(packageJson.dependencies ?? {});

  if (!declared.includes(SHARED_PACKAGE)) {
    throw new Error(`package.json 的 dependencies 里没有 ${SHARED_PACKAGE}`);
  }

  const dependencies: Record<string, string> = {};
  for (const name of declared) {
    dependencies[name] = name === SHARED_PACKAGE ? `file:./${SHARED_VENDOR_URL}` : await readInstalledVersion(name);
  }

  return dependencies;
}

async function readInstalledVersion(name: string) {
  const packageJsonPath = path.join(rootDir, "node_modules", name, "package.json");

  let installed: PackageJson;
  try {
    installed = await readJson<PackageJson>(packageJsonPath);
  } catch {
    throw new Error(`依赖 ${name} 没有安装（找不到 ${packageJsonPath}），请先在仓库根执行 pnpm install`);
  }

  if (!installed.version) {
    throw new Error(`${packageJsonPath} 里没有 version 字段`);
  }

  return installed.version;
}

/**
 * 把 packages/shared 的构建产物 vendor 进 dist。
 *
 * 不能直接拷 packages/shared/package.json：它的 dependencies 写的是 pnpm 专属的 "catalog:"，
 * npm 读到会直接报 EUNSUPPORTEDPROTOCOL；scripts / devDependencies 对生产也没有意义。
 * 这里只保留 npm 认得的字段，并把 zod 固定成实际安装的版本。
 */
async function vendorShared(dependencies: Record<string, string>) {
  const sharedDistDir = path.join(sharedDir, "dist");
  if (!(await pathExists(path.join(sharedDistDir, "index.js")))) {
    throw new Error(
      "packages/shared 还没有构建产物（packages/shared/dist/index.js 不存在）：" +
        "在仓库根执行 pnpm build（turbo 会先构建 shared），或先 pnpm --filter @repo/shared build",
    );
  }

  const sharedPackage = await readJson<PackageJson>(path.join(sharedDir, "package.json"));
  const zodVersion = dependencies.zod ?? (await readInstalledVersion("zod"));

  await mkdir(SHARED_VENDOR_PATH, { recursive: true });
  await cp(sharedDistDir, path.join(SHARED_VENDOR_PATH, "dist"), { recursive: true });

  await writeFile(
    path.join(SHARED_VENDOR_PATH, "package.json"),
    `${JSON.stringify(
      {
        name: SHARED_PACKAGE,
        version: sharedPackage.version,
        private: true,
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            default: "./dist/index.js",
          },
        },
        files: ["dist"],
        dependencies: { zod: zodVersion },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function copyRequiredFile(sourcePath: string, targetPath = sourcePath) {
  const targetFilePath = path.join(distDir, targetPath);
  await mkdir(path.dirname(targetFilePath), { recursive: true });
  await copyFile(path.join(rootDir, sourcePath), targetFilePath);
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
