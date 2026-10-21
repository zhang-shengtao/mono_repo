/// <reference types="node" />

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFilePath), "..");
const moduleName = process.argv[2]?.trim();

if (!moduleName || !/^[a-z][a-z0-9_-]*$/.test(moduleName)) {
  throw new Error("Usage: npm run gen:module <module-name>. Module name must match /^[a-z][a-z0-9_-]*$/");
}

const pascalName = toPascalCase(moduleName);
const camelName = toCamelCase(moduleName);
const detailSchemaName = `${camelName}DetailRouteOptions`;
const moduleDir = path.join(rootDir, "src", "modules", moduleName);

await mkdir(moduleDir, { recursive: true });
await writeNewFile(
  path.join(moduleDir, `${moduleName}.route.ts`),
  `import { ${detailSchemaName} } from "./${moduleName}.schema";
import ${pascalName}Service from "./${moduleName}.service";

export default async function ${camelName}Routes(fastify: FastifyInstance) {
  const ${camelName}Service = new ${pascalName}Service(fastify);

  fastify.get("/api/${moduleName}/detail", { ...${detailSchemaName} }, async function (request, reply) {
    const result = await ${camelName}Service.detail();
    return reply.success(result);
  });
}
`,
);

await writeNewFile(
  path.join(moduleDir, `${moduleName}.schema.ts`),
  `import { responseSchema, errorResponseSchema } from "@/utils";
import { z } from "zod/v4";

export const ${detailSchemaName} = {
  schema: {
    tags: ["${pascalName}"],
    summary: "获取${pascalName}详情",
    response: {
      200: responseSchema(
        z.object({
          name: z.string(),
        }),
      ),
      400: errorResponseSchema,
      401: errorResponseSchema,
      500: errorResponseSchema,
    },
  },
  config: {
    is_auth: false,
  },
};
`,
);

await writeNewFile(
  path.join(moduleDir, `${moduleName}.service.ts`),
  `export default class ${pascalName}Service {
  constructor(private readonly fastify: FastifyInstance) {}

  async detail() {
    return {
      name: "${moduleName}",
    };
  }
}
`,
);

console.log(`created module: src/modules/${moduleName}`);

async function writeNewFile(filePath: string, content: string) {
  await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
}

function toPascalCase(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value: string) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
