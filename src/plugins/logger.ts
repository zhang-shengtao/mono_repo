import fp from "fastify-plugin";

const ROUTER_LOG_TYPE = "router";
const SKIP_URL_PREFIXES = ["/docs", "/api/health"];

// 请求响应日志记录器
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

  // 成功响应：带 payload
  fastify.addHook("onSend", (req, reply, payload, done) => {
    if (shouldSkipUrl(req.url) || reply.statusCode >= 400) return done();
    fastify.log.info({
      logType: ROUTER_LOG_TYPE,
      stage: "response",
      method: req.method,
      url: req.url,
      requestId: req.id,
      statusCode: reply.statusCode,
      headers: reply.getHeaders(),
      payload,
    });
    done();
  });

  // 失败响应：onSend 不保证对所有错误路径都执行，用 onResponse 兜住 4xx/5xx
  fastify.addHook("onResponse", (req, reply, done) => {
    if (shouldSkipUrl(req.url) || reply.statusCode < 400) return done();
    fastify.log.warn({
      logType: ROUTER_LOG_TYPE,
      stage: "response",
      method: req.method,
      url: req.url,
      requestId: req.id,
      statusCode: reply.statusCode,
      elapsedMs: reply.elapsedTime,
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
