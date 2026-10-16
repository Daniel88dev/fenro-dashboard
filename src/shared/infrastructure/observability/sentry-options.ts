import type { Env } from "@/shared/config/env";

/**
 * Browsers send their events here and the server forwards them to Sentry, so
 * an ad blocker that drops requests to sentry.io does not hide client errors.
 */
export const SENTRY_TUNNEL_ROUTE = "/monitoring";

/**
 * App Runner checks /api/health every ten seconds: tracing it would spend the
 * monthly span quota on nothing. The tunnel only forwards other events.
 */
const UNTRACED_PATHS = ["/api/health", SENTRY_TUNNEL_ROUTE];

/** What the browser needs to report, rendered into the page by the server. */
export type BrowserSentryConfig = {
  readonly dsn: string;
  readonly environment: string;
  readonly release?: string;
  readonly tracesSampleRate: number;
};

/** Settings shared by the server and edge runtimes; null when Sentry is off. */
export function serverSentryOptions(env: Env) {
  if (!env.SENTRY_DSN) return null;
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE,
    tracesSampler: sampleTraces(env.SENTRY_TRACES_SAMPLE_RATE),
    dataCollection: {
      // The session cookie and agents' bearer tokens identify a person, and
      // request bodies carry task text. Neither helps read an error.
      cookies: false,
      httpHeaders: { request: { deny: ["authorization", "cookie"] } },
      httpBodies: [],
    },
  };
}

type SamplingContext = {
  readonly name: string;
  readonly normalizedRequest?: { readonly url?: string };
  readonly inheritOrSampleWith: (fallbackSampleRate: number) => number;
};

export function sampleTraces(rate: number) {
  return ({
    name,
    normalizedRequest,
    inheritOrSampleWith,
  }: SamplingContext) => {
    const target = `${name} ${normalizedRequest?.url ?? ""}`;
    if (UNTRACED_PATHS.some((path) => target.includes(path))) return 0;
    // A page's own requests follow the browser's decision, so a trace is
    // either whole or absent.
    return inheritOrSampleWith(rate);
  };
}

export function browserSentryConfig(env: Env): BrowserSentryConfig | null {
  if (!env.SENTRY_DSN) return null;
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  };
}

export const BROWSER_SENTRY_META = "fenro:sentry";

/**
 * The image is built once and configured when it starts, so the browser
 * cannot get the DSN from a build-time NEXT_PUBLIC_ variable. The root layout
 * renders it into a meta tag instead, and the client reads it back before
 * hydration.
 */
export function readBrowserSentryConfig(
  document: Pick<Document, "querySelector">,
): BrowserSentryConfig | null {
  const content = document
    .querySelector(`meta[name="${BROWSER_SENTRY_META}"]`)
    ?.getAttribute("content");
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return isBrowserSentryConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isBrowserSentryConfig(value: unknown): value is BrowserSentryConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.dsn === "string" &&
    typeof config.environment === "string" &&
    (config.release === undefined || typeof config.release === "string") &&
    typeof config.tracesSampleRate === "number"
  );
}
