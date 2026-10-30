const hasCrypto = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function";
const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function randomString(length = 16, chars = DEFAULT_CHARS) {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError("length 必须是非负整数");
  }
  const n = chars.length;
  if (n === 0) {
    throw new RangeError("chars 不能为空");
  }
  const limit = 0x100000000 - (0x100000000 % n);
  const batch = Math.max(16, length + 8);
  const buf = new Uint32Array(batch);
  let out = "";
  let idx = buf.length;
  while (out.length < length) {
    if (idx >= buf.length) {
      if (hasCrypto) {
        crypto.getRandomValues(buf);
      } else {
        for (let i = 0; i < buf.length; i++) {
          buf[i] = Math.floor(Math.random() * 0x100000000);
        }
      }
      idx = 0;
    }
    const v = buf[idx++];
    if (v < limit) {
      out += chars[v % n];
    }
  }
  return out;
}
