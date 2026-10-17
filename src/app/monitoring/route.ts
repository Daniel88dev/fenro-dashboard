import { getEnv } from "@/shared/config/env";
import { forwardSentryEnvelope } from "@/shared/infrastructure/observability/sentry-tunnel";

// Sentry's own tunnelRoute is a rewrite through Next's proxy, which adds a
// dozen close listeners per response and logs a MaxListenersExceededWarning
// for every browser event.
export function POST(request: Request) {
  return forwardSentryEnvelope(request, getEnv().SENTRY_DSN);
}
