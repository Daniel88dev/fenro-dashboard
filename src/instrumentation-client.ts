import * as Sentry from "@sentry/nextjs";

import {
  readBrowserSentryConfig,
  SENTRY_TUNNEL_ROUTE,
} from "@/shared/infrastructure/observability/sentry-options";

const config = readBrowserSentryConfig(document);

if (config) {
  Sentry.init({
    ...config,
    tunnel: SENTRY_TUNNEL_ROUTE,
    dataCollection: { cookies: false },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
