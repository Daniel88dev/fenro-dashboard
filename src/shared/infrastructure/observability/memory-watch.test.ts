import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { memoryLimitBytes, watchMemory } from "./memory-watch";

const MB = 1024 * 1024;

describe("watchMemory", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function watch(rss: () => number) {
    const warn = vi.fn();
    const stop = watchMemory({
      limitBytes: 512 * MB,
      rss,
      warn,
      now: () => Date.now(),
    });
    return { warn, stop };
  }

  it("stays quiet below the threshold", () => {
    const { warn, stop } = watch(() => 400 * MB);

    vi.advanceTimersByTime(60_000);

    expect(warn).not.toHaveBeenCalled();
    stop();
  });

  it("warns once when memory nears the limit, then waits before warning again", () => {
    const { warn, stop } = watch(() => 450 * MB);

    vi.advanceTimersByTime(10_000);
    expect(warn).toHaveBeenCalledWith({
      rssBytes: 450 * MB,
      limitBytes: 512 * MB,
    });

    vi.advanceTimersByTime(9 * 60_000);
    expect(warn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(60_000);
    expect(warn).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("memoryLimitBytes", () => {
  const files =
    (entries: Record<string, string>) =>
    async (path: string): Promise<string> => {
      const content = entries[path];
      if (content === undefined) throw new Error(`ENOENT ${path}`);
      return content;
    };

  it("reads the cgroup v2 limit", async () => {
    const read = files({ "/sys/fs/cgroup/memory.max": `${512 * MB}\n` });

    expect(await memoryLimitBytes(read, 2048 * MB)).toBe(512 * MB);
  });

  it("falls back to cgroup v1", async () => {
    const read = files({
      "/sys/fs/cgroup/memory/memory.limit_in_bytes": `${512 * MB}\n`,
    });

    expect(await memoryLimitBytes(read, 2048 * MB)).toBe(512 * MB);
  });

  it("uses the machine's memory when the cgroup has no limit", async () => {
    const read = files({ "/sys/fs/cgroup/memory.max": "max\n" });

    expect(await memoryLimitBytes(read, 480 * MB)).toBe(480 * MB);
  });

  it("uses the machine's memory when no cgroup file exists", async () => {
    expect(await memoryLimitBytes(files({}), 480 * MB)).toBe(480 * MB);
  });
});
