/** 空 sink：LOG_MODE=off 与测试用。让"关闭日志"也是一个合法实现，而不是到处写 if。 */
import type { LogSink, SinkStats } from "./types.js";

export function createOffSink(): LogSink {
  let written = 0;

  return {
    write() {
      written++;
    },
    flush(cb) {
      cb?.();
    },
    end(cb) {
      cb?.();
    },
    stats(): SinkStats {
      return { mode: "off", state: "stopped", written, dropped: 0, restarts: 0 };
    },
  };
}
