import * as Sentry from "@sentry/nextjs";

import { initSentry } from "@/shared/infrastructure/observability/sentry";

/** Runs once when a server or edge runtime starts. */
export function register(): void {
  initSentry();
}

/** Errors thrown while rendering, in route handlers and in server actions. */
export const onRequestError = Sentry.captureRequestError;
