import { readFile } from "node:fs/promises";
import { totalmem } from "node:os";

export type MemoryReading = {
  readonly rssBytes: number;
  readonly limitBytes: number;
};

export type MemoryWatchOptions = {
  readonly limitBytes: number;
  readonly rss: () => number;
  readonly warn: (reading: MemoryReading) => void;
  readonly threshold?: number;
  readonly intervalMs?: number;
  readonly quietMs?: number;
  readonly now?: () => number;
};

// The kernel's out-of-memory kill is a SIGKILL: nothing runs after it, so the
// only report Sentry can get is one sent while memory is still climbing.
export function watchMemory({
  limitBytes,
  rss,
  warn,
  threshold = 0.85,
  intervalMs = 10_000,
  quietMs = 10 * 60_000,
  now = Date.now,
}: MemoryWatchOptions): () => void {
  let warnedAt: number | undefined;
  const timer = setInterval(() => {
    const rssBytes = rss();
    if (rssBytes < limitBytes * threshold) return;
    const at = now();
    if (warnedAt !== undefined && at - warnedAt < quietMs) return;
    warnedAt = at;
    warn({ rssBytes, limitBytes });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

const UNLIMITED = 2 ** 60;

export async function memoryLimitBytes(
  read: (path: string) => Promise<string> = (path) => readFile(path, "utf8"),
  machineBytes: number = totalmem(),
): Promise<number> {
  const cgroup =
    (await cgroupLimit(read, "/sys/fs/cgroup/memory.max")) ??
    (await cgroupLimit(read, "/sys/fs/cgroup/memory/memory.limit_in_bytes"));
  return cgroup === undefined ? machineBytes : Math.min(cgroup, machineBytes);
}

async function cgroupLimit(
  read: (path: string) => Promise<string>,
  path: string,
): Promise<number | undefined> {
  try {
    const value = Number((await read(path)).trim());
    return Number.isFinite(value) && value > 0 && value < UNLIMITED
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
