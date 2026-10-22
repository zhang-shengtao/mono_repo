/** 管理后台 token 的本地存取，键名带仓库前缀，避免和同域其他应用串号 */
const TOKEN_KEY = "repo:admin:token";

export function getToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 隐私模式下 localStorage 不可写，退化成「仅当前会话内存有效」
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略
  }
}
