import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

import { getEnv } from "./src/shared/config/env";
import { SENTRY_TUNNEL_ROUTE } from "./src/shared/infrastructure/observability/sentry-options";

const nextConfig: NextConfig = {
  // The container image runs `.next/standalone/server.js` on App Runner, so
  // the build copies only the traced files the server needs. Vercel ignores
  // this setting.
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

/**
 * Source maps go to Sentry only when the release build has a token (the
 * Dockerfile's sentry_auth_token secret); CI and laptops build without one
 * and upload nothing. They are deleted afterwards, so the image does not
 * serve them.
 */
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
