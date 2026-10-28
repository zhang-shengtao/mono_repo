// type ji = string | number | null | undefined;
// type arr = ji[];
// type obj = Record<string, ji | arr | obj>;

/** 获取 localStorage 实例；SSR、隐私模式或禁用缓存时返回 null，避免直接调用报错 */
function getStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 读取原始字符串，读取失败按「不存在」处理 */
function readRaw(key: string): string | null {
  try {
    return getStore()?.getItem(key) ?? null;
  } catch (error) {
    console.warn(`[storage] 读取 "${key}" 失败：`, error);
    return null;
  }
}

/** 读取缓存，返回已反序列化的数据；不存在时返回 null（或传入的默认值） */
export function getStorage<T>(key: string): T | null;
export function getStorage<T>(key: string, defaultValue: T): T;
export function getStorage<T>(key: string, defaultValue: T | null = null): T | null {
  const raw = readRaw(key);
  // 旧版 setStorage(key, undefined) 会把 "undefined" 写进缓存，而它不是合法 JSON
  if (raw === null || raw === "undefined") return defaultValue;

  try {
    return JSON.parse(raw) as T;
  } catch {
    // 兼容历史缓存：手动 / 旧逻辑写入的纯字符串不是 JSON，原样返回
    return raw as unknown as T;
  }
}

/** 写入缓存，自动 JSON.stringify；写入成功返回 true */
export function setStorage<T>(key: string, val: T): boolean {
  const store = getStore();
  if (!store) return false;

  let raw: string | undefined;
  try {
    raw = JSON.stringify(val);
  } catch (error) {
    // 循环引用等无法序列化的数据
    console.warn(`[storage] 写入 "${key}" 失败，数据无法被 JSON 序列化：`, error);
    return false;
  }

  // undefined / function / symbol 序列化后为 undefined，等价于删除该缓存
  if (raw === undefined) {
    removeStorage(key);
    return true;
  }

  try {
    store.setItem(key, raw);
    return true;
  } catch (error) {
    // 超出存储配额（QuotaExceededError）等
    console.warn(`[storage] 写入 "${key}" 失败：`, error);
    return false;
  }
}

/** 删除指定缓存 */
export function removeStorage(key: string): void {
  getStore()?.removeItem(key);
}

/** 清空当前域名下的全部缓存 */
export function clearStorage(): void {
  getStore()?.clear();
}
