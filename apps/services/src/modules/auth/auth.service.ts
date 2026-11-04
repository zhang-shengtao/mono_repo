import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import svgCaptcha from "svg-captcha-fixed";
import { BusinessCode } from "@repo/shared";
import type { AdminProfile, LoginBody } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminUser, type AdminUser } from "@/db/admin_user";
import type { CachedAuthUser, DecodedJwtPayload } from "@/types/auth";
import { hashPassword, verifyPassword } from "@/utils/password";
import { sessionSetKey } from "@/utils/session";

const CAPTCHA_KEY_PREFIX = "admin:captcha:";

const CAPTCHA_TTL_SECONDS = 60;

export default class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  async issueCaptcha() {
    const captcha = svgCaptcha.createMathExpr({
      noise: 4,
      color: true,
      width: 140,
      height: 48,
      fontSize: 42,
      background: "#eef2f9",
      mathOperator: "+-",
    });

    const captchaId = randomUUID();
    await this.fastify.redis.set(`${CAPTCHA_KEY_PREFIX}${captchaId}`, captcha.text.toLowerCase(), "EX", CAPTCHA_TTL_SECONDS);

    return { captcha_id: captchaId, image: captcha.data };
  }

  async login(body: LoginBody) {
    await this.consumeCaptcha(body.captcha_id, body.code);

    const [user] = await this.fastify.db.select().from(adminUser).where(eq(adminUser.account, body.account)).limit(1);
    if (!user) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");

    const verification = await verifyPassword(body.password, user.password);
    if (!verification.valid) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");
    if (user.status !== "normal") throw new AppError(BusinessCode.ADMIN_DISABLED, "账号已被禁用，请联系超级管理员");

    if (verification.needsRehash) {
      const password = await hashPassword(body.password);
      await this.fastify.db.update(adminUser).set({ password }).where(eq(adminUser.user_id, user.user_id));
    }

    const profile = toProfile(user);
    const uid = randomUUID();
    const token = this.fastify.jwt.admin.sign({ uid });
    const decoded = this.fastify.jwt.admin.decode<DecodedJwtPayload>(token);
    if (!decoded?.exp) throw new AppError(BusinessCode.INTERNAL_ERROR, "令牌签发失败");

    const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1);
    const sessionKey = sessionSetKey(user.user_id);
    await this.fastify.redis
      .multi()
      .set(uid, JSON.stringify(profile satisfies CachedAuthUser), "EX", ttl)
      .sadd(sessionKey, uid)
      .expire(sessionKey, ttl)
      .exec();

    return { token, expires_in: ttl };
  }

  getProfile(user: AdminUser): AdminProfile {
    return toProfile(user);
  }

  async logout(uid: string, userId: number) {
    await this.fastify.redis.multi().del(uid).srem(sessionSetKey(userId), uid).exec();
  }

  private async consumeCaptcha(captchaId: string, code: string) {
    const key = `${CAPTCHA_KEY_PREFIX}${captchaId}`;
    const answer = await this.fastify.redis.get(key);
    if (answer !== null) await this.fastify.redis.del(key);

    if (answer === null) {
      throw new AppError(BusinessCode.PARAM_ERROR, "验证码已过期，请刷新后重试");
    }
    if (answer !== code.trim().toLowerCase()) {
      throw new AppError(BusinessCode.PARAM_ERROR, "验证码不正确，请重新输入");
    }
  }
}

function toProfile(user: AdminUser): AdminProfile {
  return {
    user_id: user.user_id,
    parent_id: user.parent_id,
    account: user.account,
    nickname: user.nickname,
    status: user.status,
  };
}
