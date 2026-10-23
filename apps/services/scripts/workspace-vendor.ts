/// <reference types="node" />
import { access, cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";


const VENDOR_DIR = "vendor";

/** 包里没有 files 字段时，按惯例只发布 dist */
const DEFAULT_FILES = ["dist"];

/** npm 不认、必须换成真实版本号的协议 */
const NON_NPM_PROTOCOLS = ["catalog:", "workspace:"];

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  type?: string;
  engines?: Record<string, string>;
  exports?: unknown;
  main?: string;
  types?: string;
  bin?: string | Record<string, string>;
  files?: string[];
  sideEffects?: boolean;
  dependencies?: Record<string, string>;
}

interface LocalPackage {
  name: string;
  version: string;
  /** 该包在仓库里的真实目录（软链已解开） */
  dir: string;
  /** dist/vendor 下的目录名：去掉 scope，@repo/shared → shared */
  slug: string;
  manifest: PackageJson;
}

export interface WorkspaceVendorOptions {
  /** 应用的包目录（读它的 package.json / dependencies） */
  rootDir: string;
  /** 应用的输出目录（通常是 apps/<app>/dist） */
  distDir: string;
  /** 仓库根：判断某个路径是否在仓库内，也只用来拼报错提示 */
  repoDir: string;
}

export async function vendorWorkspaceDependencies(options: WorkspaceVendorOptions): Promise<Record<string, string>> {
  const { rootDir, distDir, repoDir } = options;
  const appManifest = await readJson<PackageJson>(path.join(rootDir, "package.json"));
  const packages = await discoverLocalPackages({ appManifest, rootDir, repoDir });
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));

  const dependencies = await resolveDistDependencies({ appManifest, packages, byName, rootDir });

  if (packages.length === 0) {
    console.log(`[build]   （dependencies 里没有 workspace 包，dist/package.json 直接写死版本）`);
    return dependencies;
  }

  for (const pkg of packages) {
    await vendorLocalPackage({ pkg, byName, distDir, repoDir, resolved: dependencies });
    console.log(`[build]   + ${pkg.name}@${pkg.version} → dist/${VENDOR_DIR}/${pkg.slug}`);
  }

  return dependencies;
}

async function discoverLocalPackages(params: {
  appManifest: PackageJson;
  rootDir: string;
  repoDir: string;
}): Promise<LocalPackage[]> {
  const { appManifest, rootDir, repoDir } = params;
  const discovered = new Map<string, LocalPackage>();
  const queue: Array<{ dir: string; manifest: PackageJson }> = [{ dir: rootDir, manifest: appManifest }];

  while (queue.length > 0) {
    const owner = queue.shift();
    if (!owner) break;

    for (const [name, spec] of Object.entries(owner.manifest.dependencies ?? {})) {
      if (discovered.has(name)) continue;

      const packageDir = await resolveLocalPackageDir({ ownerDir: owner.dir, name, spec, repoDir });
      if (!packageDir) continue;

      const manifest = await readJson<PackageJson>(path.join(packageDir, "package.json"));
      if (manifest.name === appManifest.name) continue;

      discovered.set(manifest.name ?? name, {
        name: manifest.name ?? name,
        version: manifest.version ?? "0.0.0",
        dir: packageDir,
        slug: slugOf(name),
        manifest,
      });
      queue.push({ dir: packageDir, manifest });
    }
  }

  const packages = [...discovered.values()];
  assertUniqueSlugs(packages);
  return packages;
}


async function resolveLocalPackageDir(params: {
  ownerDir: string;
  name: string;
  spec: string;
  repoDir: string;
}): Promise<string | undefined> {
  const { ownerDir, name, spec, repoDir } = params;

  if (spec.startsWith("workspace:")) {
    const linkPath = path.join(ownerDir, "node_modules", name);
    if (!(await pathExists(linkPath))) {
      throw new Error(`${name} 是 workspace 依赖（${spec}），但 ${linkPath} 不存在：先在仓库根执行 pnpm install`);
    }

    const packageDir = await realpath(linkPath);
    assertInsideRepo({ repoDir, packageDir, name, spec });
    return packageDir;
  }

  if (spec.startsWith("link:") || spec.startsWith("file:")) {
    const target = path.resolve(ownerDir, spec.slice(spec.indexOf(":") + 1));
    if (!isInside(repoDir, target)) return undefined;

    const packageDir = await realpath(target);
    assertInsideRepo({ repoDir, packageDir, name, spec });
    return packageDir;
  }

  return undefined;
}


async function resolveDistDependencies(params: {
  appManifest: PackageJson;
  packages: LocalPackage[];
  byName: Map<string, LocalPackage>;
  rootDir: string;
}): Promise<Record<string, string>> {
  const { appManifest, packages, byName, rootDir } = params;
  const dependencies: Record<string, string> = {};

  for (const [name, spec] of Object.entries(appManifest.dependencies ?? {})) {
    dependencies[name] = await distSpecifierOf({
      name,
      spec,
      local: byName.get(name),
      searchDirs: [rootDir],
      owner: "package.json",
    });
  }

  for (const pkg of packages) {
    for (const [name, spec] of Object.entries(pkg.manifest.dependencies ?? {})) {
      if (dependencies[name] !== undefined) continue;

      dependencies[name] = await distSpecifierOf({
        name,
        spec,
        local: byName.get(name),
        searchDirs: [pkg.dir, rootDir],
        owner: `${pkg.name} 的 dependencies`,
      });
      console.log(`[build]   + ${name} → ${dependencies[name]}（${pkg.name} 依赖它，自动补进 dist 依赖）`);
    }
  }

  return dependencies;
}


async function distSpecifierOf(params: {
  name: string;
  spec: string;
  local: LocalPackage | undefined;
  searchDirs: string[];
  owner: string;
}): Promise<string> {
  const { name, spec, local, searchDirs, owner } = params;
  if (local) return `file:./${VENDOR_DIR}/${local.slug}`;

  if (!shouldPinVersion(spec)) return spec;

  const installed = await readInstalledVersion(name, searchDirs);
  if (!installed) {
    const looked = searchDirs.map((dir) => path.join(dir, "node_modules", name)).join("、");
    throw new Error(`${owner} 里的 ${name}（${spec}）没有安装：${looked} 都找不到，先在仓库根执行 pnpm install`);
  }

  return installed;
}


function shouldPinVersion(spec: string) {
  if (NON_NPM_PROTOCOLS.some((protocol) => spec.startsWith(protocol))) return true;
  return !/^[a-z][a-z+.-]*:/i.test(spec);
}


async function vendorLocalPackage(params: {
  pkg: LocalPackage;
  byName: Map<string, LocalPackage>;
  distDir: string;
  repoDir: string;
  resolved: Record<string, string>;
}) {
  const { pkg, byName, distDir, repoDir, resolved } = params;

  const entryPath = path.join(pkg.dir, resolveEntryFile(pkg.manifest));
  if (!(await pathExists(entryPath))) {
    throw new Error(
      `${pkg.name} 没有可用的构建产物（缺 ${path.relative(repoDir, entryPath)}）：` +
        "在仓库根执行 pnpm build（turbo 会先按依赖顺序构建被依赖的包），" +
        `或先执行 pnpm --filter ${pkg.name} build`,
    );
  }

  const vendorDir = path.join(distDir, VENDOR_DIR, pkg.slug);
  await mkdir(vendorDir, { recursive: true });

  const files = pkg.manifest.files?.length ? pkg.manifest.files : DEFAULT_FILES;
  for (const file of files) {
    const source = path.join(pkg.dir, file);
    if (!(await pathExists(source))) continue;
    await cp(source, path.join(vendorDir, file), { recursive: true });
  }

  const dependencies: Record<string, string> = {};
  for (const [name, spec] of Object.entries(pkg.manifest.dependencies ?? {})) {
    const local = byName.get(name);
    dependencies[name] = local ? `file:../${local.slug}` : (resolved[name] ?? spec);
  }

  await writeFile(
    path.join(vendorDir, "package.json"),
    `${JSON.stringify(buildVendorManifest(pkg, dependencies), null, 2)}\n`,
    "utf8",
  );
}


function buildVendorManifest(pkg: LocalPackage, dependencies: Record<string, string>) {
  const source = pkg.manifest;
  const manifest: Record<string, unknown> = {
    name: pkg.name,
    version: pkg.version,
    private: true,
  };

  if (source.description) manifest.description = source.description;
  if (source.type) manifest.type = source.type;
  if (source.engines) manifest.engines = source.engines;
  if (source.sideEffects !== undefined) manifest.sideEffects = source.sideEffects;
  if (source.bin) manifest.bin = source.bin;
  if (source.exports) manifest.exports = source.exports;
  if (source.main) manifest.main = source.main;
  if (source.types) manifest.types = source.types;
  if (source.files) manifest.files = source.files;
  if (Object.keys(dependencies).length > 0) manifest.dependencies = dependencies;

  return manifest;
}

function resolveEntryFile(manifest: PackageJson) {
  return readRootExport(manifest.exports) ?? manifest.main ?? "dist/index.js";
}

function readRootExport(exportsField: unknown): string | undefined {
  if (typeof exportsField === "string") return exportsField;
  if (!exportsField || typeof exportsField !== "object") return undefined;

  const map = exportsField as Record<string, unknown>;
  const root = "." in map ? map["."] : map;
  if (typeof root === "string") return root;
  if (!root || typeof root !== "object") return undefined;

  const conditions = root as Record<string, unknown>;
  for (const condition of ["default", "import", "node", "require"]) {
    const value = conditions[condition];
    if (typeof value === "string") return value;
  }

  return undefined;
}

function slugOf(name: string) {
  const short = name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name;
  return short.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function assertUniqueSlugs(packages: LocalPackage[]) {
  const bySlug = new Map<string, string>();
  for (const pkg of packages) {
    const existing = bySlug.get(pkg.slug);
    if (existing) {
      throw new Error(
        `${existing} 和 ${pkg.name} 的 vendor 目录名都是 ${pkg.slug}，dist/${VENDOR_DIR} 下会互相覆盖：` +
          "两个包不能去掉 scope 后同名",
      );
    }

    bySlug.set(pkg.slug, pkg.name);
  }
}

function assertInsideRepo(params: { repoDir: string; packageDir: string; name: string; spec: string }) {
  const { repoDir, packageDir, name, spec } = params;
  if (!isInside(repoDir, packageDir)) {
    throw new Error(`${name}（${spec}）解析到了仓库外（${packageDir}），不像是 workspace 包，检查依赖写法`);
  }
}

function isInside(parentDir: string, target: string) {
  const relative = path.relative(parentDir, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}


async function readInstalledVersion(name: string, searchDirs: string[]) {
  for (const dir of searchDirs) {
    try {
      const manifest = await readJson<PackageJson>(path.join(dir, "node_modules", name, "package.json"));
      if (manifest.version) return manifest.version;
    } catch {}
  }

  return undefined;
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
