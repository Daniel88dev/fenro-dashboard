import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { oAuthProxy } from "better-auth/plugins";

import { getEnv, requireEnv } from "@/shared/config/env";
import type { Database } from "@/shared/infrastructure/database/client";

import { refreshGitHubToken } from "./github-token-refresh";
import { identitySchema } from "./persistence/schema";

/**
 * "Sign in with GitHub" goes through a GitHub App, not an OAuth app. A GitHub
 * App's user token carries the app's own permissions (read-only: metadata,
 * pull requests, issues, checks, commit statuses and email addresses) and only
 * reaches repositories the app is installed on, so OAuth scopes mean nothing
 * to it. None are sent, Better Auth's `read:user` and `user:email` defaults
 * included, so the consent screen lists only what the app was given.
 */
export const GITHUB_SCOPES = [] as const;

export type AuthSettings = {
  readonly baseUrl: string;
  readonly secret: string;
  readonly github: { readonly clientId: string; readonly clientSecret: string };
  /** Where GitHub's callback lands when this deployment is not that origin. */
  readonly oauthProxy?: { readonly url: string; readonly secret?: string };
};

/**
 * The whole sign-in policy in one place, kept a pure function of its inputs so
 * it can be tested without a database: GitHub is the only way in, and there is
 * no email and password.
 */
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
        // A GitHub App's user token expires after eight hours and comes with a
        // single-use refresh token, which Better Auth trades in when the token
        // is read. GitHub reports a refused refresh with a 200, which Better
        // Auth's default refresh would store as a token.
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
      // Previews get a new URL each time, which the GitHub App's callback URLs
      // cannot list, so a preview signs in through the production origin, which finishes the code exchange and hands the
      // encrypted result back. Without a proxy URL, this deployment counts as
      // production and the plugin only ever answers for others. `currentURL`
      // is pinned because a server action has no request URL to infer it
      // from, and the platform URL it would fall back to is per-deployment.
      oAuthProxy({
        productionURL: settings.oauthProxy?.url ?? settings.baseUrl,
        currentURL: settings.baseUrl,
        secret: settings.oauthProxy?.secret,
      }),
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

/**
 * Built on first use rather than at import, so `next build` and the tests run
 * without the GitHub App or the database configured.
 */
export function getAuth(db: () => Database): Auth {
  if (instance) return instance;

  const { OAUTH_PROXY_URL, OAUTH_PROXY_SECRET } = getEnv();
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
      oauthProxy: OAUTH_PROXY_URL
        ? { url: OAUTH_PROXY_URL, secret: OAUTH_PROXY_SECRET }
        : undefined,
    },
    db(),
  );
  return instance;
}
