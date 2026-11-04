const EXTERNAL_RE = /^https?:\/\//i;

export function isExternal(raw?: string | null): boolean {
  return typeof raw === "string" && EXTERNAL_RE.test(raw.trim());
}

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

export function joinPath(parentAbs: string, childPath?: string | null): string {
  const child = (childPath ?? "").trim();
  if (isExternal(child)) return child;
  if (!child) return normalizePath(parentAbs);
  if (child.startsWith("/")) return normalizePath(child);
  return normalizePath(`${parentAbs}/${child}`);
}

export function resolveMenuPath(parentAbs: string, rawPath?: string | null): string {
  const path = normalizePath(rawPath);
  if (!path || isExternal(path)) return path;

  const parent = normalizePath(parentAbs);
  if (!parent || parent === "/") return path;
  if (path === parent || path.startsWith(`${parent}/`)) return path;

  return normalizePath(`${parent}${path}`);
}
