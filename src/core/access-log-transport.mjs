import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import build from "pino-abstract-transport";

function formatLogDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function transport(options = {}) {
  const logDir = path.resolve(options.logDir ?? path.join(process.cwd(), "logs"));
  const routerLogDir = path.join(logDir, "router");
  const appLogDir = path.join(logDir, "log");
  await Promise.all([mkdir(routerLogDir, { recursive: true }), mkdir(appLogDir, { recursive: true })]);

  const streams = new Map();

  function getStream(logType, dateText) {
    const streamKey = logType === "router" ? "router" : "log";
    const targetDir = streamKey === "router" ? routerLogDir : appLogDir;
    const current = streams.get(streamKey);
    if (current && current.dateText === dateText) {
      return current.stream;
    }

    if (current) {
      current.stream.end();
    }

    const nextStream = createWriteStream(path.join(targetDir, `${dateText}.log`), {
      flags: "a",
      encoding: "utf8",
    });
    streams.set(streamKey, { dateText, stream: nextStream });

    return nextStream;
  }

  const transportStream = build(async function (source) {
    for await (const obj of source) {
      const time = obj.time ? new Date(obj.time) : new Date();
      const stream = getStream(obj.logType, formatLogDate(time));
      stream.write(`${JSON.stringify(obj)}\n`);
    }
  });

  // pino 退出前会 flush：等文件流的缓冲区写完，避免丢掉最后几条日志
  transportStream.flush = function flush(callback) {
    const pending = [...streams.values()].map(
      ({ stream }) =>
        new Promise((resolve) => {
          stream.write("", () => resolve());
        }),
    );

    Promise.all(pending).then(
      () => callback?.(),
      () => callback?.(),
    );
  };

  return transportStream;
}
