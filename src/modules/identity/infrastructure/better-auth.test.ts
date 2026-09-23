// @vitest-environment node
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { authOptions, GITHUB_SCOPES } from "./better-auth";

const settings = {
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
