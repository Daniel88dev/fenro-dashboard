import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { requireEnv } from "@/shared/config/env";
import type { Database } from "@/shared/infrastructure/database/client";

import { identitySchema } from "./persistence/schema";

/**
 * What the dashboard asks GitHub for, on top of Better Auth's defaults
 * (`read:user` for the profile, `user:email` because every user needs an
 * email). `repo` is the only OAuth-app scope that can read private
 * repositories' pull requests, issues and checks; there is no read-only
 * variant of it. A GitHub App with fine-grained read permissions would be
 * narrower, and is the way to go if write access ever becomes a concern.
 */
export const GITHUB_SCOPES = ["repo"] as const;

export type AuthSettings = {
  readonly baseUrl: string;
  readonly secret: string;
  readonly github: { readonly clientId: string; readonly clientSecret: string };
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
        scope: [...GITHUB_SCOPES],
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
    // Lets server actions set the cookies a sign-in or sign-out produces.
    // Better Auth wants it last.
    plugins: [nextCookies()],
  } satisfies BetterAuthOptions;
}

function createAuth(settings: AuthSettings, db: Database) {
  return betterAuth(authOptions(settings, db));
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/**
 * Built on first use rather than at import, so `next build` and the tests run
 * without the OAuth app or the database configured.
 */
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
