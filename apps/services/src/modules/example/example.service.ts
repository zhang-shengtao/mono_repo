import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AppError } from "@/core/app-error";
import { BusinessCode } from "@repo/shared";
import { adminUser } from "@/db/admin-user";
import type { DecodedJwtPayload } from "@/types/auth";

export default class ExampleService {
  constructor(private readonly fastify: FastifyInstance) {}

  async login(username: string, password: string) {
    const users = await this.fastify.db.select().from(adminUser).where(eq(adminUser.account, username));
    if (users.length === 0) throw new AppError(BusinessCode.PARAM_ERROR, "账号或密码错误");

    const foundUser = users.find((candidate) => candidate.password === password);
    if (!foundUser) throw new AppError(BusinessCode.PARAM_ERROR, "账号或密码错误");

    const { password: _password, ...userInfo } = foundUser;
    const uid = randomUUID();
    const token = this.fastify.jwt.admin.sign({ uid });
    const decoded = this.fastify.jwt.admin.decode<DecodedJwtPayload>(token);
    if (!decoded?.exp) throw new AppError(BusinessCode.INTERNAL_ERROR, "服务器错误");

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    await this.fastify.redis.set(uid, JSON.stringify(userInfo), "EX", ttl);
    return token;
  }

  async chat(name: string, reply: FastifyReply) {
    // reply.raw.destroyed = true 客户端断开连接
    // reply.raw.writableEnded = true 服务端这一侧已经调用过 reply.raw.end()
    let isOpen = true;
    reply.raw.socket?.on("close", () => {
      console.log("close=>", "断开了");
      isOpen = false;
    });
    await reply.raw.write(
      sseFormat({
        id: "-1",
        event: "open",
        data: {
          text: "链接成功",
        },
      }),
    );
    for (let i = 0; i <= 10; i++) {
      // if (reply.raw.destroyed) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // if (reply.raw.destroyed) break;
      if (!isOpen) break;
      console.log("writableEnded=>" + i, reply.raw.destroyed, reply.raw.writableEnded, Date.now());
      await reply.raw.write(
        sseFormat({
          id: i,
          event: "message",
          data: {
            text: name + i,
            index: i,
          },
        }),
      );
      this.fastify.log.info({ data: `data: ${name + i}\n\n` });
    }
    if (reply.raw.writableEnded === false && reply.raw.destroyed === false) {
      await reply.raw.write(
        sseFormat({
          event: "end",
          data: {
            text: `${name}结束`,
          },
        }),
      );
      this.fastify.log.info({ data: `data: ${name}结束\n\n` });
      reply.raw.end();
    }
    console.log("writableEnded=>", reply.raw.destroyed, reply.raw.writableEnded);
  }
}

function sseFormat(options: { id?: string | number; event?: string; data: unknown; retry?: number }) {
  let output = "";
  if (options.id !== undefined) {
    output += `id: ${options.id}\n`;
  }
  if (options.event) {
    output += `event: ${options.event}\n`;
  }
  if (options.retry !== undefined) {
    output += `retry: ${options.retry}\n`;
  }
  const data = typeof options.data === "string" ? options.data : JSON.stringify(options.data);
  for (const line of data.split(/\r?\n/)) {
    output += `data: ${line}\n`;
  }
  return `${output}\n`;
}
