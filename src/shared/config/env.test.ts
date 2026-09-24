import { describe, expect, it } from "vitest";

import { getEnv, requireEnv } from "./env";

describe("getEnv", () => {
  it("applies defaults for optional settings", () => {
    const env = getEnv({ NODE_ENV: "test" });

    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it("rejects a malformed value and names it", () => {
    expect(() => getEnv({ APP_URL: "not-a-url" })).toThrow(/APP_URL/);
  });

  it("reads an empty value, as .env.example leaves them, as not set", () => {
    const env = getEnv({
      DATABASE_URL: "",
      BETTER_AUTH_SECRET: "",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "",
      GITHUB_TOKEN: "",
    });

    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.BETTER_AUTH_SECRET).toBeUndefined();
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
  });

  it("falls back to the Vercel branch URL when APP_URL is unset", () => {
    const env = getEnv({
      VERCEL_BRANCH_URL: "fenro-git-branch.vercel.app",
      VERCEL_URL: "fenro-abc123.vercel.app",
    });

    expect(env.APP_URL).toBe("https://fenro-git-branch.vercel.app");
  });

  it("prefers an explicit APP_URL over the platform's", () => {
    const env = getEnv({
      APP_URL: "https://fenro.example",
      VERCEL_BRANCH_URL: "fenro-git-main.vercel.app",
    });

    expect(env.APP_URL).toBe("https://fenro.example");
  });

  it("rejects an auth secret too short to be one", () => {
    expect(() => getEnv({ BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});

describe("requireEnv", () => {
  it("returns the settings when every one is present", () => {
    const env = getEnv({ DATABASE_URL: "postgres://localhost/fenro" });

    expect(requireEnv(["DATABASE_URL"], env).DATABASE_URL).toBe(
      "postgres://localhost/fenro",
    );
  });

  it("names every missing setting at once", () => {
    const env = getEnv({ GITHUB_CLIENT_ID: "abc" });

    expect(() =>
      requireEnv(
        ["DATABASE_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
        env,
      ),
    ).toThrow(
      "Missing environment variables: DATABASE_URL, GITHUB_CLIENT_SECRET.",
    );
  });
});
