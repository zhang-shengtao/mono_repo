/**
 * 路径工具：动态路由里所有「比 path」的地方都走这里，保证两边用的是同一套规则。
 *
 * 三种形态：
 *   站内路径  /system/menu   规范化（补前导 /、折叠 //、去尾 /）
 *   外链      https://x.com  原样返回，不做任何规整（URL 里的 // 和结尾的 / 有意义）
 *   空值      ""             返回空串，调用方自己判断
 */

const EXTERNAL_RE = /^https?:\/\//i;

/** 是否外链（外链只进菜单，不注册路由） */
export function isExternal(raw?: string | null): boolean {
  return typeof raw === "string" && EXTERNAL_RE.test(raw.trim());
}

/** 站内路径规范化；外链原样返回 */
export function normalizePath(raw?: string | null): string {
  if (!raw) return "";

  const value = raw.trim();
  if (isExternal(value)) return value;

  let path = value.split(/[?#]/)[0].replace(/\/{2,}/g, "/");
  if (!path) return "";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path;
}

/**
 * 前端路由表：子级的相对 path 拼到父级后面。
 * 以 / 开头的视为已经是完整路径（和 vue-router 的语义一致）。
 */
export function joinPath(parentAbs: string, childPath?: string | null): string {
  const child = (childPath ?? "").trim();
  if (isExternal(child)) return child;
  if (!child) return normalizePath(parentAbs);
  if (child.startsWith("/")) return normalizePath(child);
  return normalizePath(`${parentAbs}/${child}`);
}

/**
 * 后端菜单：meta.path 可能是相对写法（`/menu` 挂在 `/system` 下），也可能是完整路径。
 * 统一拼成完整路径再拿去比对 —— 已经是完整路径的（以父级开头）原样返回，避免拼成 `/system/system/menu`。
 */
export function resolveMenuPath(parentAbs: string, rawPath?: string | null): string {
  const path = normalizePath(rawPath);
  if (!path || isExternal(path)) return path;

  const parent = normalizePath(parentAbs);
  if (!parent || parent === "/") return path;
  if (path === parent || path.startsWith(`${parent}/`)) return path;

  return normalizePath(`${parent}${path}`);
}
