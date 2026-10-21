import { randomUUID } from "node:crypto";
import svgCaptcha from "svg-captcha-fixed";
import { captchaRouteOptions, healthRouteOptions } from "./global.schema";
import GlobalService from "./global.service";

export default async function globalRoutes(fastify: FastifyInstance) {
  const globalService = new GlobalService(fastify);

  fastify.get("/api/health/ready", { ...healthRouteOptions }, async function (request, reply) {
    return reply.success(await globalService.health());
  });

  fastify.get("/admin/captcha/image", { ...captchaRouteOptions }, async function (request, reply) {
    const captcha = svgCaptcha.createMathExpr({
      noise: 5,
      color: true,
      width: 140,
      height: 44,
      fontSize: 42,
      background: "#d6d6d6",
      mathOperator: "+-",
    });
    const captchaId = randomUUID();
    const answer = captcha.text.toLowerCase();
    await fastify.redis.set(`captcha_id:${captchaId}`, answer, "EX", 60);
    return reply.success({ captcha_id: captchaId, image: captcha.data });
  });
}
