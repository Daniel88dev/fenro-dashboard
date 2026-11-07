import * as Sentry from "@sentry/nextjs";

import { initSentry } from "@/shared/infrastructure/observability/sentry";

export async function register(): Promise<void> {
  initSentry();
  // Next sets NEXT_RUNTIME itself; the edge runtime has no node:fs or node:os.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportHighMemory } =
      await import("@/shared/infrastructure/observability/sentry-memory");
    await reportHighMemory();
  }
}

export const onRequestError = Sentry.captureRequestError;
