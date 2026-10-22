import fp from "fastify-plugin";
import websocket from "@fastify/websocket";

async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, {
    errorHandler(error, socket, _req, _reply) {
      //WebSocket 连接建立之后，如果你的 WebSocket route handler 里抛错，会进入这个 errorHandler
      fastify.log.error({ err: error, tip: "websocket报错" }, "websocket 连接异常");
      socket.terminate();
    },
    options: {
      maxPayload: 1048576, // 1M缓冲区
      clientTracking: false, // 是否让底层 WebSocket Server 自动维护当前连接的客户端集合。 fastify.websocketServer.clients.forEach
    },
  });
}

export default fp(websocketPlugin, { name: "websocket" });
