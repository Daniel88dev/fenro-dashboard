import * as Sentry from "@sentry/nextjs";

import { initSentry } from "@/shared/infrastructure/observability/sentry";

export function register(): void {
  initSentry();
}

export const onRequestError = Sentry.captureRequestError;
