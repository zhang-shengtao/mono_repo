import fp from "fastify-plugin";

const ROUTER_LOG_TYPE = "router";
const SKIP_URL_PREFIXES = ["/docs", "/api/health"];

// 只记录请求日志：响应侧不落盘（响应体可能带 token 等敏感内容，日志量也大）
async function loggerPlugin(fastify: FastifyInstance) {
  // 用 preValidation 而不是 preHandler：
  // 生命周期是 onRequest → preValidation → 参数校验 → preHandler → handler，
  // 挂在 preHandler 会让「参数校验失败(400)」和「鉴权失败(401/403)」的请求完全不落日志。
  fastify.addHook("preValidation", (req, reply, done) => {
    if (shouldSkipUrl(req.url)) return done();
    fastify.log.info({
      logType: ROUTER_LOG_TYPE,
      stage: "request",
      method: req.method,
      url: req.url,
      requestId: req.id,
      ip: req.ip,
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });
    done();
  });
}

function shouldSkipUrl(url: string) {
  return SKIP_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export default fp(loggerPlugin, {
  name: "logger",
});
