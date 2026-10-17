import { describe, expect, it, vi } from "vitest";

import { forwardSentryEnvelope } from "./sentry-tunnel";

const DSN = "https://public@o1.ingest.de.sentry.io/2";

function envelope(dsn: string) {
  return new Request("https://fenro.test/monitoring", {
    method: "POST",
    body: `${JSON.stringify({ dsn, sent_at: "2026-10-17T09:00:00Z" })}\n{"type":"event"}\n{}`,
  });
}

describe("forwardSentryEnvelope", () => {
  it("posts our project's envelope to its Sentry ingest", async () => {
    const send = vi.fn(async () => new Response("{}", { status: 200 }));

    const response = await forwardSentryEnvelope(envelope(DSN), DSN, send);

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      "https://o1.ingest.de.sentry.io/api/2/envelope/",
      expect.objectContaining({ method: "POST" }),
    );
    const body = (send.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(new TextDecoder().decode(body.body as Uint8Array)).toContain(
      '{"type":"event"}',
    );
  });

  it("passes Sentry's rate limits back so the browser backs off", async () => {
    const send = async () =>
      new Response(null, {
        status: 429,
        headers: { "retry-after": "60", "x-sentry-rate-limits": "60::org" },
      });

    const response = await forwardSentryEnvelope(envelope(DSN), DSN, send);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("x-sentry-rate-limits")).toBe("60::org");
  });

  it("refuses envelopes for another Sentry project", async () => {
    const send = vi.fn();

    const otherProject = await forwardSentryEnvelope(
      envelope("https://public@o1.ingest.de.sentry.io/3"),
      DSN,
      send,
    );
    const otherHost = await forwardSentryEnvelope(
      envelope("https://public@evil.test/2"),
      DSN,
      send,
    );

    expect(otherProject.status).toBe(400);
    expect(otherHost.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a body that is not an envelope", async () => {
    const request = new Request("https://fenro.test/monitoring", {
      method: "POST",
      body: "not json",
    });

    expect((await forwardSentryEnvelope(request, DSN, vi.fn())).status).toBe(
      400,
    );
  });

  it("is absent while Sentry is off", async () => {
    expect(
      (await forwardSentryEnvelope(envelope(DSN), undefined, vi.fn())).status,
    ).toBe(404);
  });

  it("answers 502 when Sentry cannot be reached", async () => {
    const send = async () => {
      throw new TypeError("fetch failed");
    };

    expect((await forwardSentryEnvelope(envelope(DSN), DSN, send)).status).toBe(
      502,
    );
  });
});
