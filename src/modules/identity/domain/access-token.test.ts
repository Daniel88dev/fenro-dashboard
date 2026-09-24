import { describe, expect, it } from "vitest";

import { AccessToken } from "./access-token";
import {
  accessTokenHint,
  generateAccessTokenSecret,
  hashAccessTokenSecret,
  looksLikeAccessToken,
} from "./access-token-secret";

const NOW = new Date("2026-09-23T10:00:00Z");
const MINUTE = 60 * 1000;

function issue(
  overrides: Partial<Parameters<typeof AccessToken.issue>[0]> = {},
) {
  return AccessToken.issue({
    id: "4a1f1a0e-3a52-4b8e-9f4c-1c2d3e4f5a6b",
    ownerId: "user-1",
    name: "Claude Code on my laptop",
    scopes: ["tasks:read"],
    secretHash: "hash",
    hint: "abcd",
    lifetimeDays: 30,
    now: NOW,
    ...overrides,
  });
}

function issued(overrides: Parameters<typeof issue>[0] = {}): AccessToken {
  const result = issue(overrides);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("AccessToken.issue", () => {
  it("expires after the lifetime asked for", () => {
    expect(issued({ lifetimeDays: 30 }).expiresAt).toEqual(
      new Date("2026-10-23T10:00:00Z"),
    );
  });

  it.each([
    [{ name: "   " }, /name/],
    [{ name: "x".repeat(61) }, /under 60/],
    [{ scopes: [] }, /at least one scope/],
    [{ scopes: ["repo"] }, /Unknown scope: repo/],
    [{ lifetimeDays: 0 }, /between 1 and 366/],
    [{ lifetimeDays: 400 }, /between 1 and 366/],
  ])("refuses %o", (overrides, message) => {
    const result = issue(overrides);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(message);
  });

  it("gives read access with write access", () => {
    expect(issued({ scopes: ["tasks:write"] }).scopes).toEqual([
      "tasks:read",
      "tasks:write",
    ]);
  });
});

describe("an issued token", () => {
  it("stops working once expired or revoked", () => {
    const token = issued({ lifetimeDays: 1 });
    expect(token.isUsable(NOW)).toBe(true);
    expect(token.isUsable(new Date("2026-09-24T10:00:00Z"))).toBe(false);

    token.revoke(NOW);
    expect(token.isUsable(NOW)).toBe(false);
  });

  it("writes down its use at most every five minutes", () => {
    const token = issued();
    expect(token.recordUse(NOW)).toBe(true);
    expect(token.recordUse(new Date(NOW.getTime() + 4 * MINUTE))).toBe(false);
    expect(token.lastUsedAt).toEqual(NOW);
    expect(token.recordUse(new Date(NOW.getTime() + 5 * MINUTE))).toBe(true);
  });
});

describe("access token secrets", () => {
  it("are prefixed, recognisable and different every time", () => {
    const first = generateAccessTokenSecret();
    expect(looksLikeAccessToken(first)).toBe(true);
    expect(first).not.toBe(generateAccessTokenSecret());
    expect(looksLikeAccessToken("ghp_notours")).toBe(false);
  });

  it("hash to SHA-256 hex and hint at their last four characters", async () => {
    expect(await hashAccessTokenSecret("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(accessTokenHint("fenro_pat_xyz1234")).toBe("1234");
  });
});
