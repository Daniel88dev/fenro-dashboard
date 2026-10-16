import { describe, expect, it } from "vitest";

import { getEnv } from "@/shared/config/env";

import {
  BROWSER_SENTRY_META,
  browserSentryConfig,
  readBrowserSentryConfig,
  sampleTraces,
  serverSentryOptions,
} from "./sentry-options";

const DSN = "https://public@o1.ingest.de.sentry.io/2";

describe("serverSentryOptions", () => {
  it("leaves Sentry off without a DSN", () => {
    expect(serverSentryOptions(getEnv({ NODE_ENV: "test" }))).toBeNull();
  });

  it("tags events with the environment and the release", () => {
    const options = serverSentryOptions(
      getEnv({
        NODE_ENV: "production",
        SENTRY_DSN: DSN,
        SENTRY_RELEASE: "abc123",
      }),
    );

    expect(options).toMatchObject({
      dsn: DSN,
      environment: "production",
      release: "abc123",
    });
  });

  it("keeps cookies and request bodies out of events", () => {
    const options = serverSentryOptions(getEnv({ SENTRY_DSN: DSN }));

    expect(options?.dataCollection).toMatchObject({
      cookies: false,
      httpBodies: [],
    });
  });
});

describe("sampleTraces", () => {
  const inheritOrSampleWith = (rate: number) => rate;

  it("never traces health checks or the event tunnel", () => {
    const sample = sampleTraces(1);

    expect(sample({ name: "GET /api/health", inheritOrSampleWith })).toBe(0);
    expect(
      sample({
        name: "POST",
        normalizedRequest: { url: "https://x.test/monitoring?o=1&p=2" },
        inheritOrSampleWith,
      }),
    ).toBe(0);
  });

  it("samples everything else at the configured rate", () => {
    expect(
      sampleTraces(0.25)({ name: "POST /api/mcp", inheritOrSampleWith }),
    ).toBe(0.25);
  });
});

describe("the browser's config", () => {
  function pageWith(content: string | null) {
    const document = window.document.implementation.createHTMLDocument();
    if (content !== null) {
      const meta = document.createElement("meta");
      meta.name = BROWSER_SENTRY_META;
      meta.content = content;
      document.head.append(meta);
    }
    return document;
  }

  it("reads back what the server rendered", () => {
    const config = browserSentryConfig(
      getEnv({ SENTRY_DSN: DSN, SENTRY_TRACES_SAMPLE_RATE: "0.5" }),
    );

    expect(readBrowserSentryConfig(pageWith(JSON.stringify(config)))).toEqual({
      dsn: DSN,
      environment: "development",
      tracesSampleRate: 0.5,
    });
  });

  it("is absent when the page carries none or a broken one", () => {
    expect(readBrowserSentryConfig(pageWith(null))).toBeNull();
    expect(readBrowserSentryConfig(pageWith("{not json"))).toBeNull();
    expect(readBrowserSentryConfig(pageWith('{"dsn":1}'))).toBeNull();
  });
});
