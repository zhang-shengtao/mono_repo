import fp from "fastify-plugin";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { env } from "@/core/env";

async function swaggerPlugin(fastify: FastifyInstance) {
  // 接口文档按环境开关，生产默认不暴露
  if (!env.API_DOCS_ENABLED) return;

  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "模板项目接口文档",
        description: "接口文档",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "需要登录的接口请在请求头中传入：Authorization: Bearer <token>",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await fastify.register(apiReference, {
    routePrefix: "/docs",
    configuration: {
      title: "服务器api文档",
      theme: "bluePlanet",
      layout: "modern",
      modelsSectionLabel: "数据模型",
      defaultHttpClient: {
        targetKey: "shell",
        clientKey: "curl",
      },
      documentDownloadType: "json",
      hideClientButton: false,
      showDeveloperTools: "never",
      mcp: {
        disabled: true,
      },
      agent: {
        disabled: true,
      },
      authentication: {
        preferredSecurityScheme: "bearerAuth",
      },
      persistAuth: true,
    },
    logLevel: "silent",
  });
}

export default fp(swaggerPlugin, {
  name: "swagger",
});
