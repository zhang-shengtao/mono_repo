/** 三种读法（cat / tail / 末尾 N 行）共用的底层，消灭 readline 样板 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { matchLine } from "./line.js";

export interface LineFilter {
  level?: string;
  grep?: string;
}

/** 按行流式读文件，可指定字节区间 */
export async function* readLines(
  filePath: string,
  range: { start?: number; end?: number } = {},
): AsyncGenerator<string> {
  const stream = createReadStream(filePath, { encoding: "utf8", ...range });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of reader) {
      if (line.length > 0) yield line;
    }
  } finally {
    reader.close();
    stream.destroy();
  }
}

/** 末尾 N 行（只算匹配 filter 的） */
export async function readLastLines(filePath: string, count: number, filter: LineFilter = {}): Promise<string[]> {
  const buffer: string[] = [];
  for await (const line of readLines(filePath)) {
    if (!matchLine(line, filter.level, filter.grep)) continue;
    buffer.push(line);
    if (buffer.length > count) buffer.shift();
  }
  return buffer;
}

/** 从 offset 读到末尾；半行留给下一次（正在追加写入时会读到残缺行） */
export async function readFromOffset(
  filePath: string,
  offset: number,
): Promise<{ lines: string[]; nextOffset: number }> {
  let text = "";
  for await (const chunk of createReadStream(filePath, { start: offset, encoding: "utf8" })) {
    text += chunk as string;
  }

  const lastBreak = text.lastIndexOf("\n");
  if (lastBreak === -1) return { lines: [], nextOffset: offset };

  const complete = text.slice(0, lastBreak + 1);
  return {
    lines: complete.split("\n").filter((line) => line.length > 0),
    nextOffset: offset + Buffer.byteLength(complete, "utf8"),
  };
}
