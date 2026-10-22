# @repo/shared · 前后端共享契约

> **一句话**：本仓库（pnpm workspace + Turborepo）里**唯一的前后端共用代码库**，被 `apps/services`
> 与 `apps/admin` 同时引用；它只放「不依赖任何运行时框架」的纯 TypeScript 契约 ——
> **业务状态码**和**统一响应包络 schema**，避免两端各写一份、各错一半。

| 项目     | 值                                                                            |
| -------- | ----------------------------------------------------------------------------- |
| 包名     | `@repo/shared`（`packages/shared`）                                           |
| 角色     | 被引用的库（不是可部署应用），`private: true`                                 |
| 运行形态 | 编译成原生 ESM + `.d.ts`，由 `package.json#exports` 暴露                      |
| 产出     | `dist/index.js`、`dist/index.d.ts`、`dist/business-code.*`、`dist/response.*` |
| 使用方   | `apps/services`（vendored 进后端 dist）、`apps/admin`（由 Vite 打包）         |

---

## 一、这个项目是干嘛的

一个**只做类型与常量共享的最小包**。它解决的问题是「前后端对同一份协议理解不一致」：

| 导出                   | 内容                                                              | 谁在用                                                            |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `BusinessCode`         | 业务状态码字典（成功、参数错误、未授权、禁用、限流……）            | 后端 `AppError` / `reply.error`；前端区分「密码错」和「账号禁用」 |
| `responseSchema(data)` | 成功响应包络的 zod schema（`code / message / data / request_id`） | 后端生成 OpenAPI 响应 schema；前端推导响应类型                    |
| `errorResponseSchema`  | 失败响应包络的 zod schema（`data` 恒为 `null`）                   | 同上                                                              |

例子：

```ts
// 后端 apps/services：用共享业务码构造错误、用共享 schema 描述接口响应
import { BusinessCode, responseSchema } from "@repo/shared";

// 前端 apps/admin：用同一份业务码做分支判断，不再手写 401 / 403 魔法数字
import { BusinessCode } from "@repo/shared";

if (error.code === BusinessCode.ADMIN_DISABLED) {
  // 提示「账号被禁用」，而不是笼统的「密码错误」
}
```

**不该放进来的东西**（这几样属于后端自己的事）：

- 权限码常量与种子数据 → `apps/services/src/permissions/`；
  跨端通道是数据库 + HTTP（`/code` 接口），不是 npm 包。
- 鉴权相关类型（`RouteAuthConfig` 等）→ `apps/services/src/types/`。
- 任何依赖 `fastify` 的代码或类型增强 → 只能留在 `apps/services`。

判断标准：**「两端是否真的都要用，且不引入框架依赖」**。只要有一条不满足，就不要下沉到这个包。

---

## 二、目录结构与每个文件的作用

```
packages/shared/
├── src/
│   ├── index.ts          # 统一出口：只做 re-export，不写逻辑
│   ├── business-code.ts  # BusinessCode 常量字典 + BusinessCode 类型
│   └── response.ts       # responseSchema(data) / errorResponseSchema（zod）
├── dist/                 # 编译产物（tsc 生成，不入库）
├── tsconfig.json         # module / moduleResolution = NodeNext，rootDir=src，outDir=dist，declaration=true
└── package.json          # exports "." → dist/index.js|d.ts；files: ["dist"]；scripts: build / dev / typecheck / prepare
```

- 只有 `src/` 是手写代码，`dist/` 一律由 `tsc` 生成，**不要手改、不要提交**。
- `exports` 只暴露包根（`"."`），所以消费方只能 `import { ... } from "@repo/shared"`，
  不能 `@repo/shared/business-code` 这样进子路径。

---

## 三、技术栈

| 分类     | 选型                                                  | 说明                                                       |
| -------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| 语言     | TypeScript 6.x（`strict` + `verbatimModuleSyntax`）   | 版本由仓库 `pnpm-workspace.yaml` 的 `catalog:` 统一        |
| 校验库   | Zod 4（`zod/v4`）                                     | 产出的 schema 同时给后端 OpenAPI 与前端类型用              |
| 模块格式 | **Node ESM**（`type: "module"` + `module: NodeNext`） | 产物要被 Node 原生加载，不经过打包器                       |
| 构建     | `tsc`（无 bundler、无 `tsup`/rollup）                 | 一行 `tsc -p tsconfig.json`，产物结构 = 源码结构 + `.d.ts` |
| 规范     | Prettier（仓库根统一配置）                            | 在仓库根执行 `pnpm format`                                 |

唯一的运行时依赖是 `zod`（必须留在 `dependencies` 里——消费方要靠它拿到同一份 zod 实例）。

---

## 四、怎么打包（构建）与发布

### 4.1 构建

```bash
pnpm --filter @repo/shared build          # tsc -p tsconfig.json → dist/
pnpm build                                # 仓库根：turbo 会按依赖顺序先构建本包
pnpm --filter @repo/shared dev            # tsc --watch（pnpm dev 已经带上了）
pnpm --filter @repo/shared typecheck      # 只做类型检查
```

- `pnpm install` 会顺带执行本包的 `prepare`（= `tsc`），所以克隆仓库装完依赖就能被解析。
- 构建只有一步 `tsc`：**没有** 混淆、压缩、sourcemap，也没有单独的 `.d.ts` 生成步骤（`declaration: true` 直接产出）。
- `turbo.json` 的 `build` 缓存 `dist/**`，命中缓存时会直接还原产物。

### 4.2 两个使用方怎么拿到它

```
packages/shared/dist/  (ESM + .d.ts)
        │
        │  workspace 软链：node_modules/@repo/shared → packages/shared
        ├─────────────► apps/services   build 时整份拷进 dist/vendor/shared
        └─────────────► apps/admin      Vite 直接打进前端 bundle
```

- **后端（`apps/services`）**：源码里写 `import { BusinessCode } from "@repo/shared"`；
  `scripts/build.ts` 会把 `packages/shared/dist` 拷进 `dist/vendor/shared`，并把依赖声明改成
  `file:./vendor/shared` —— 因为 npm 不认 pnpm 的 `workspace:*` 协议。
  **所以打包后端前，本包必须已经构建过**（turbo 的 `build: dependsOn ["^build"]` 保证了这一点）。
- **前端（`apps/admin`）**：Vite 通过 `node_modules/@repo/shared` 软链解析到本包，
  `exports` 的 `types` 给 `vue-tsc` 做类型检查，`default` 给打包器做 tree-shaking。
  同样要求 `dist/` 已存在。

### 4.3 发版说明

这是 `private: true` 的 workspace 内部包，**不发 npm，也没有独立版本号节奏**：仓库内用
`workspace:*` 引用，跟着 monorepo 一起发布。改了它等于改了后端和前端的契约，记得两边都重新构建：

```bash
pnpm --filter @repo/shared build
pnpm --filter @repo/services build     # 重新 vendor
pnpm --filter @repo/admin build        # 重新打包前端
```

---

## 五、约定与已知坑

1. **包内相对导入必须带 `.js` 后缀**（哪怕源码是 `.ts`）：`export * from "./business-code.js"`。
   产物要被 Node 原生 ESM 直接加载，Node 不会替你补扩展名。
2. **不要给 `@repo/shared` 配 tsconfig `paths`**。它是真实包，靠 `node_modules` 软链 +
   `package.json#exports` 解析；写成 paths 会让后端构建时的 `tsc-alias` 把 import 改写成指向包外源码的
   相对路径，产物直接跑不起来。
3. **不允许依赖 `fastify`**：Fastify 模块增强留在 `apps/services/src/types/fastify.d.ts`，
   否则前端会莫名其妙把 fastify 拖进依赖树。
4. **只放两端都要用的纯契约**：权限码、种子数据、后端路由的 `RouteAuthConfig` 都别往这里搬。
5. **改完要重新构建**：单独跑后端或前端前，先 `pnpm --filter @repo/shared build`（或在仓库根 `pnpm dev`，
   它已带 `tsc --watch`），否则会报 `ERR_MODULE_NOT_FOUND: @repo/shared`。
6. **新增导出要过 `src/index.ts`**：`exports` 只暴露包根，漏了 barrel 导出，消费方就 import 不到。
7. **`zod` 版本走 catalog**：本包与 `apps/services` 都写 `"zod": "catalog:"`，
   保证 `zod/v4` 只有一份实例，schema 才能被两边的类型系统正确合并。
