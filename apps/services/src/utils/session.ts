/**
 * 一个账号的全部会话 id 集合。
 *
 * 登录时 sadd、登出时 srem；禁用 / 删除账号时整批清掉，令牌立刻失效。
 * auth.service（登录 / 登出）与 user.service（禁用 / 删除）共用这份前缀，避免各写一份导致漂移。
 */
const SESSION_SET_PREFIX = "admin:user:sessions:";

export function sessionSetKey(userId: number) {
  return `${SESSION_SET_PREFIX}${userId}`;
}
