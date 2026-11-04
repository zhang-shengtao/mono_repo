const SESSION_SET_PREFIX = "admin:user:sessions:";

export function sessionSetKey(userId: number) {
  return `${SESSION_SET_PREFIX}${userId}`;
}
