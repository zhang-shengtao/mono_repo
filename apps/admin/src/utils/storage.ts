export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

const LEGACY_UNDEFINED_RAW = "undefined";

function getStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readRaw(key: string): string | null {
  try {
    return getStore()?.getItem(key) ?? null;
  } catch (error) {
    console.warn(`[storage] 读取 "${key}" 失败：`, error);
    return null;
  }
}

function parseRaw(raw: string): JsonValue | undefined {
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return undefined;
  }
}

export function getStorage<T extends JsonValue = JsonValue>(key: string): T | null;
export function getStorage<T extends JsonValue>(key: string, defaultValue: T): T;
export function getStorage<T extends JsonValue = JsonValue>(key: string, defaultValue: T | null = null): T | null {
  const raw = readRaw(key);
  if (raw === null || raw === LEGACY_UNDEFINED_RAW) return defaultValue;

  const parsed = parseRaw(raw);
  return (parsed === undefined ? raw : parsed) as T;
}

export function setStorage(key: string, value: JsonValue): boolean {
  const store = getStore();
  if (!store) return false;

  let raw: string | undefined;
  try {
    raw = JSON.stringify(value);
  } catch (error) {
    console.warn(`[storage] 序列化 "${key}" 失败：`, error);
    return false;
  }

  if (raw === undefined) {
    removeStorage(key);
    return true;
  }

  try {
    store.setItem(key, raw);
    return true;
  } catch (error) {
    console.warn(`[storage] 写入 "${key}" 失败：`, error);
    return false;
  }
}

export function removeStorage(key: string): boolean {
  const store = getStore();
  if (!store) return false;

  try {
    store.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[storage] 删除 "${key}" 失败：`, error);
    return false;
  }
}

export function clearStorage(): boolean {
  const store = getStore();
  if (!store) return false;

  try {
    store.clear();
    return true;
  } catch (error) {
    console.warn(`[storage] 清空缓存失败：`, error);
    return false;
  }
}
