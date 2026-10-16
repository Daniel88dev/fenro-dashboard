import * as Sentry from "@sentry/nextjs";

import { readBrowserSentryConfig } from "@/shared/infrastructure/observability/sentry-options";

const config = readBrowserSentryConfig(document);

if (config) {
  Sentry.init({
    ...config,
    dataCollection: { cookies: false },
    // The free plan holds 50 replays a month, so record only the sessions an
    // error happened in. Text and pictures are masked: they are tasks.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
