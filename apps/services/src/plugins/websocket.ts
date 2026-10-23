import fp from "fastify-plugin";
import websocket from "@fastify/websocket";

async function websocketPlugin(fastify: FastifyInstance) {
  await fastify.register(websocket, {
    errorHandler(error, socket, _req, _reply) {
      fastify.log.error({ err: error, tip: "websocket报错" }, "websocket 连接异常");
      socket.terminate();
    },
    options: {
      maxPayload: 1048576,
      clientTracking: false,
    },
  });
}

export default fp(websocketPlugin, { name: "websocket" });
