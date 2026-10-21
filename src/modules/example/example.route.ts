import type { ChatData } from "./example.schema";
import { exampleChatRouteOptions, exampleLoginRouteOptions, exampleWsRouteOptions } from "./example.schema";
import ExampleService from "./example.service";

export default async function exampleRoutes(fastify: FastifyInstance) {
  const exampleService = new ExampleService(fastify);

  fastify.post("/admin/example/login", { ...exampleLoginRouteOptions }, async function (request, reply) {
    const token = await exampleService.login(request.body.username, request.body.password);
    return reply.success({ token });
  });

  fastify.post("/api/example/chat", { ...exampleChatRouteOptions }, async function (request, reply) {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "request-id": request.id,
    });
    void exampleService.chat(request.body.name, reply);
  });

  fastify.get("/api/example/ws", { websocket: true, ...exampleWsRouteOptions }, function (socket, req) {
    socket.send(JSON.stringify({ type: "open", id: req.id }));
    socket.on("message", (message: Buffer) => {
      const msg = JSON.parse(message.toString()) as ChatData;
      socket.send(JSON.stringify({ ...msg, id: req.id }));
      if (msg.type === "chat") {
        socket.close();
      }
    });
    socket.on("close", () => {
      console.log("close=>", "断开了");
    });
  });
}
