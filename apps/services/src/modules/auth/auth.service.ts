import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import svgCaptcha from "svg-captcha-fixed";
import { BusinessCode } from "@repo/shared";
import { AppError } from "@/core/app_error";
import { adminUser, type AdminUser } from "@/db/admin_user";
import type { CachedAuthUser, DecodedJwtPayload } from "@/types/auth";
import { hashPassword, verifyPassword } from "@/utils/password";
import type { AdminProfile, LoginBody } from "./auth.schema";

/** 验证码在 Redis 里的 key 前缀（@fastify/redis 会再拼上 REDIS_PREFIX） */
const CAPTCHA_KEY_PREFIX = "admin:captcha:";
/** 验证码有效期：60 秒，够输入，又不至于被反复复用 */
const CAPTCHA_TTL_SECONDS = 60;
/** 一个账号的全部会话 id，登出/禁用时可以按账号批量清理 */
const SESSION_SET_PREFIX = "admin:user:sessions:";

export default class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  /** 生成算式验证码：答案只进 Redis，图片（SVG）返回给前端 */
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

  /**
   * 登录：
   * 1. 验证码一次性消费（无论对错都删 key，防止同一张图反复试）
   * 2. 账号密码校验，错误提示统一为「账号或密码错误」，不泄露账号是否存在
   * 3. 签发 JWT，并把「令牌 id → 用户快照」写进 Redis —— jwt 插件的鉴权钩子只认这里的会话，
   *    所以登出 = 删 Redis key，令牌立刻失效
   */
  async login(body: LoginBody) {
    await this.consumeCaptcha(body.captcha_id, body.code);

    const [user] = await this.fastify.db.select().from(adminUser).where(eq(adminUser.account, body.account)).limit(1);
    if (!user) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");

    const verification = await verifyPassword(body.password, user.password);
    if (!verification.valid) throw new AppError(BusinessCode.ADMIN_LOGIN_FAILED, "账号或密码错误");
    if (user.status !== "normal") throw new AppError(BusinessCode.ADMIN_DISABLED, "账号已被禁用，请联系超级管理员");

    // 旧的哈希参数（内存/轮数）落伍时，趁着密码还在手里顺手升级
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
    const sessionKey = this.sessionSetKey(user.user_id);
    await this.fastify.redis
      .multi()
      .set(uid, JSON.stringify(profile satisfies CachedAuthUser), "EX", ttl)
      .sadd(sessionKey, uid)
      .expire(sessionKey, ttl)
      .exec();

    return { token, expires_in: ttl };
  }

  /** 当前登录管理员：身份来自 jwt 插件已校验的会话，资料以数据库为准 */
  async getProfile(uid: string) {
    const cached = await this.readSession(uid);
    const [user] = await this.fastify.db
      .select({
        user_id: adminUser.user_id,
        parent_id: adminUser.parent_id,
        account: adminUser.account,
        nickname: adminUser.nickname,
        status: adminUser.status,
      })
      .from(adminUser)
      .where(eq(adminUser.user_id, cached.user_id))
      .limit(1);
    if (!user) throw new AppError(BusinessCode.UNAUTHORIZED, "账号不存在，请重新登录");

    return user;
  }

  /** 退出登录：删会话 + 从账号的会话集合里摘掉，令牌立刻失效 */
  async logout(uid: string) {
    const cached = await this.readSession(uid).catch(() => null);
    await this.fastify.redis.del(uid);
    if (cached) await this.fastify.redis.srem(this.sessionSetKey(cached.user_id), uid);
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

  private async readSession(uid: string) {
    const cached = await this.fastify.redis.get(uid);
    if (!cached) throw new AppError(BusinessCode.UNAUTHORIZED, "登录状态已失效，请重新登录");

    try {
      return JSON.parse(cached) as CachedAuthUser;
    } catch {
      throw new AppError(BusinessCode.UNAUTHORIZED, "登录信息无效，请重新登录");
    }
  }

  private sessionSetKey(userId: number) {
    return `${SESSION_SET_PREFIX}${userId}`;
  }
}

/** 数据库行 → 对外投影（去掉密码、时间戳等不该下发的字段） */
function toProfile(user: AdminUser): AdminProfile {
  return {
    user_id: user.user_id,
    parent_id: user.parent_id,
    account: user.account,
    nickname: user.nickname,
    status: user.status,
  };
}
