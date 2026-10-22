import fp from "fastify-plugin";
import { env } from "@/core/env";
import { createJwtGuard } from "@/core/jwt-guard";

const userJwtPlugin = createJwtGuard({
  realm: "user",
  secret: env.USER_JWT_SECRET,
  issuer: env.JWT_ISSUER_USER,
  expiresIn: env.ACCESS_TOKEN_TTL,
});

export default fp(userJwtPlugin, {
  name: "jwt-user",
});
