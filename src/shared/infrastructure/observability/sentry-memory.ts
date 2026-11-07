import * as Sentry from "@sentry/nextjs";

import {
  memoryLimitBytes,
  watchMemory,
  type MemoryReading,
} from "./memory-watch";

export async function reportHighMemory(): Promise<void> {
  const limitBytes = await memoryLimitBytes();
  watchMemory({
    limitBytes,
    rss: () => process.memoryUsage.rss(),
    warn: report,
  });
}

function report({ rssBytes, limitBytes }: MemoryReading): void {
  const { heapUsed, heapTotal, external } = process.memoryUsage();
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  Sentry.captureMessage(
    `Server memory at ${mb(rssBytes)} of ${mb(limitBytes)} MB`,
    {
      level: "warning",
      fingerprint: ["server-memory-high"],
      contexts: {
        memory: {
          rss_mb: mb(rssBytes),
          limit_mb: mb(limitBytes),
          heap_used_mb: mb(heapUsed),
          heap_total_mb: mb(heapTotal),
          external_mb: mb(external),
        },
      },
    },
  );
}
