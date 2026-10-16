import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { requireEnv } from "@/shared/config/env";
import type { Database } from "@/shared/infrastructure/database/client";

import { refreshGitHubToken } from "./github-token-refresh";
import { identitySchema } from "./persistence/schema";

// A GitHub App's user token carries the app's own permissions, so OAuth scopes
// mean nothing to it; sending none drops Better Auth's defaults from consent.
export const GITHUB_SCOPES = [] as const;

export type AuthSettings = {
  readonly baseUrl: string;
  readonly secret: string;
  readonly github: { readonly clientId: string; readonly clientSecret: string };
};

export function authOptions(settings: AuthSettings, db: Database) {
  return {
    appName: "Fenro Dashboard",
    baseURL: settings.baseUrl,
    secret: settings.secret,
    database: drizzleAdapter(db, { provider: "pg", schema: identitySchema }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: {
        clientId: settings.github.clientId,
        clientSecret: settings.github.clientSecret,
        disableDefaultScope: true,
        scope: [...GITHUB_SCOPES],
        // GitHub reports a refused refresh with a 200, which Better Auth's default
        // refresh would store as a token.
        refreshAccessToken: (refreshToken) =>
          refreshGitHubToken(refreshToken, settings.github),
        // GitHub usernames can change; keep ours in step on every sign-in.
        overrideUserInfoOnSignIn: true,
        mapProfileToUser: (profile) => ({ githubLogin: profile.login }),
      },
    },
    user: {
      additionalFields: {
        // Has to accept input: Better Auth drops `input: false` fields from
        // what `mapProfileToUser` returns too. `/update-user` is closed below
        // instead, so GitHub stays the only thing that can set it.
        githubLogin: { type: "string", required: false },
      },
    },
    // The profile is GitHub's and is rewritten on every sign-in, so nothing
    // here edits it; a user who could would be able to claim another login.
    disabledPaths: ["/update-user"],
    account: {
      // The token reads the user's repositories; don't keep it in plain text.
      encryptOAuthTokens: true,
    },
    session: {
      // A signed cookie answers "who is this" for five minutes before the
      // database is asked again, so a dashboard render costs no session query.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      // Lets server actions set the cookies a sign-in or sign-out produces.
      // Better Auth wants it last.
      nextCookies(),
    ],
  } satisfies BetterAuthOptions;
}

function createAuth(settings: AuthSettings, db: Database) {
  return betterAuth(authOptions(settings, db));
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

// Built on first use, not at import, so `next build` and the tests run without
// the GitHub App or the database configured.
export function getAuth(db: () => Database): Auth {
  if (instance) return instance;

  const env = requireEnv([
    "APP_URL",
    "BETTER_AUTH_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
  ]);
  instance = createAuth(
    {
      baseUrl: env.APP_URL,
      secret: env.BETTER_AUTH_SECRET,
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    db(),
  );
  return instance;
}
