// @vitest-environment node
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { authOptions, type AuthSettings, GITHUB_SCOPES } from "./better-auth";

const settings: AuthSettings = {
  baseUrl: "http://localhost:3000",
  secret: "a-secret-that-is-at-least-32-characters",
  github: { clientId: "client-id", clientSecret: "client-secret" },
};

const options = () => authOptions(settings, drizzle.mock());

describe("authOptions", () => {
  it("offers GitHub as the only way in", () => {
    expect(Object.keys(options().socialProviders)).toEqual(["github"]);
    expect(options().emailAndPassword.enabled).toBe(false);
  });

  it("asks GitHub for repository access, on top of the profile defaults", () => {
    expect(options().socialProviders.github.scope).toEqual([...GITHUB_SCOPES]);
    expect(GITHUB_SCOPES).toContain("repo");
  });

  it("keeps the GitHub login, and refreshes it on every sign-in", async () => {
    const github = options().socialProviders.github;

    expect(github.overrideUserInfoOnSignIn).toBe(true);
    await expect(
      Promise.resolve(
        github.mapProfileToUser({ login: "Daniel88dev" } as Parameters<
          typeof github.mapProfileToUser
        >[0]),
      ),
    ).resolves.toEqual({ githubLogin: "Daniel88dev" });
  });

  it("lets nobody but GitHub change the profile, the login included", () => {
    expect(options().disabledPaths).toContain("/update-user");
  });

  it("does not store GitHub tokens in plain text", () => {
    expect(options().account.encryptOAuthTokens).toBe(true);
  });
});

describe("signing in from a preview", () => {
  const PRODUCTION = "https://fenro.example";
  const PREVIEW = "https://fenro-git-branch.example";

  async function gitHubAuthorizationUrl(overrides: Partial<AuthSettings>) {
    const auth = betterAuth({
      ...authOptions({ ...settings, ...overrides }, drizzle.mock()),
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
      }),
    });
    const { url } = await auth.api.signInSocial({
      body: { provider: "github", callbackURL: "/repositories" },
    });
    return new URL(url!);
  }

  it("sends GitHub back to the production origin, which owns the callback", async () => {
    const url = await gitHubAuthorizationUrl({
      baseUrl: PREVIEW,
      oauthProxy: {
        url: PRODUCTION,
        secret: "a-proxy-secret-that-is-32-characters",
      },
    });

    expect(url.searchParams.get("redirect_uri")).toBe(
      `${PRODUCTION}/api/auth/callback/github`,
    );
  });

  it("leaves production's own sign-in alone", async () => {
    const url = await gitHubAuthorizationUrl({
      baseUrl: PRODUCTION,
      oauthProxy: { url: PRODUCTION },
    });

    expect(url.searchParams.get("redirect_uri")).toBe(
      `${PRODUCTION}/api/auth/callback/github`,
    );
  });

  it("uses its own callback when no proxy is configured", async () => {
    const url = await gitHubAuthorizationUrl({ baseUrl: PREVIEW });

    expect(url.searchParams.get("redirect_uri")).toBe(
      `${PREVIEW}/api/auth/callback/github`,
    );
  });
});
