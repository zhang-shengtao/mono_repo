import fp from "fastify-plugin";
import { env } from "@/core/env";
import { createJwtGuard } from "@/core/jwt-guard";

const adminJwtPlugin = createJwtGuard({
  realm: "admin",
  secret: env.ADMIN_JWT_SECRET,
  issuer: env.JWT_ISSUER_ADMIN,
  expiresIn: env.ACCESS_TOKEN_TTL,
});

export default fp(adminJwtPlugin, {
  name: "jwt-admin",
});
