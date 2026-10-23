/**
 * 等一个「回调式完成」的操作，超时后强制收尾。
 *
 * 统一了四处写法：writer.close / sink.end / setup.shutdown / child-main.finish。
 * 定时器一律 unref —— 超时兜底不能反过来把进程留住。
 */
export function onceWithTimeout(start: (done: () => void) => void, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    timer.unref();

    try {
      start(finish);
    } catch {
      finish();
    }
  });
}
