/**
 * 生成一个随机字符串
 * @param length 长度
 * @returns String
 */
export function randomString(length = 12) {
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(36)).join("");
}
