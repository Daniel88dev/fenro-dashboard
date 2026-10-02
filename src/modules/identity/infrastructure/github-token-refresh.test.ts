// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { refreshGitHubToken } from "./github-token-refresh";

const client = { clientId: "Iv23.abc", clientSecret: "secret" };
const NOW = new Date("2026-10-02T12:00:00Z");

function answering(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("refreshGitHubToken", () => {
  it("trades the refresh token for a new pair, with both expiries", async () => {
    // The shape GitHub documents for a GitHub App user token refresh.
    const fetchImpl = answering({
      access_token: "ghu_new",
      expires_in: 28800,
      refresh_token: "ghr_new",
      refresh_token_expires_in: 15811200,
      scope: "",
      token_type: "bearer",
    });

    const tokens = await refreshGitHubToken(
      "ghr_old",
      client,
      fetchImpl,
      () => NOW,
    );

    expect(tokens).toEqual({
      accessToken: "ghu_new",
      refreshToken: "ghr_new",
      tokenType: "bearer",
      accessTokenExpiresAt: new Date("2026-10-02T20:00:00Z"),
      refreshTokenExpiresAt: new Date("2027-04-03T12:00:00Z"),
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(Object.fromEntries(init!.body as URLSearchParams)).toEqual({
      client_id: "Iv23.abc",
      client_secret: "secret",
      grant_type: "refresh_token",
      refresh_token: "ghr_old",
    });
  });

  it("throws when GitHub refuses with a 200, instead of storing no token", async () => {
    const fetchImpl = answering({
      error: "bad_refresh_token",
      error_description: "The refresh token passed is incorrect or expired.",
      error_uri: "https://docs.github.com/apps/troubleshooting",
    });

    await expect(
      refreshGitHubToken("ghr_spent", client, fetchImpl),
    ).rejects.toThrow("The refresh token passed is incorrect or expired.");
  });

  it("throws when GitHub answers with an error status", async () => {
    const fetchImpl = answering({ message: "Server Error" }, 500);

    await expect(
      refreshGitHubToken("ghr_old", client, fetchImpl),
    ).rejects.toThrow("status 500");
  });
});
