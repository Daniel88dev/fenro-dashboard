import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { getEnv } from "./src/shared/config/env";
import { SENTRY_TUNNEL_ROUTE } from "./src/shared/infrastructure/observability/sentry-options";

const nextConfig: NextConfig = {
  // The Docker image runs `.next/standalone/server.js`; Vercel ignores this.
  output: "standalone",
  images: {
    // No page uses next/image, and outside Vercel the optimiser would run in
    // the app's own container. Keep it off so adding one later is a choice.
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    // Sentry loads its diagnostics-channel hook by a path the file tracer
    // cannot follow. Without it the standalone server records no Postgres
    // spans, and says so on start-up.
    "/**": [
      "./node_modules/.pnpm/@sentry+server-runtime-injection@*/node_modules/@sentry/server-runtime-injection/build/**",
    ],
  },
};

const env = getEnv();

export default withSentryConfig(nextConfig, {
  org: env.SENTRY_ORG,
  project: env.SENTRY_PROJECT,
  authToken: env.SENTRY_AUTH_TOKEN,
  release: { name: env.SENTRY_RELEASE },
  sourcemaps: {
    disable: !env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: true,
  tunnelRoute: SENTRY_TUNNEL_ROUTE,
  silent: !env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
