import { headers } from "next/headers";
import { cache } from "react";

import type {
  Authenticator,
  SignedInUser,
} from "@/modules/identity/application/ports/authenticator";

import { getEnv } from "@/shared/config/env";

import type { Auth } from "./better-auth";

type SessionUser = {
  id: string;
  name: string;
  image?: string | null;
  githubLogin?: string | null;
};

// A user without a GitHub login is a row written before the login was
// captured; treating it as signed out makes sign-in fill it in.
export function toSignedInUser(user: SessionUser): SignedInUser | null {
  if (!user.githubLogin) return null;
  return {
    id: user.id,
    name: user.name,
    githubLogin: user.githubLogin,
    image: user.image ?? null,
  };
}

export function gitHubAppInstallUrl(slug: string | undefined): string | null {
  return slug
    ? `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`
    : null;
}

export class BetterAuthAuthenticator implements Authenticator {
  // `headers()` comes first on purpose: it tells `next build` the page is per
  // request, so the build never tries to create Better Auth without its settings.
  readonly #session = cache(async () => {
    const requestHeaders = await headers();
    return this.auth().api.getSession({ headers: requestHeaders });
  });

  readonly #gitHubAccessToken = cache(async (): Promise<string | null> => {
    const session = await this.#session();
    if (!session) return null;

    const requestHeaders = await headers();
    const accounts = await this.auth().api.listUserAccounts({
      headers: requestHeaders,
    });
    const github = accounts.find((account) => account.providerId === "github");
    if (!github) return null;

    // Reading the token refreshes it when it has expired. A refused refresh
    // (revoked, expired, or spent by a parallel request) means no token, so
    // the page asks for sign-in instead of failing.
    try {
      const token = await this.auth().api.getAccessToken({
        body: { accountId: github.id },
        headers: requestHeaders,
      });
      return token.accessToken || null;
    } catch (error) {
      console.warn("[github] could not get a valid access token", error);
      return null;
    }
  });

  constructor(private readonly auth: () => Auth) {}

  async signedInUser(): Promise<SignedInUser | null> {
    const session = await this.#session();
    return session ? toSignedInUser(session.user) : null;
  }

  gitHubAccessToken(): Promise<string | null> {
    return this.#gitHubAccessToken();
  }

  async beginGitHubSignIn(paths: {
    returnTo: string;
    onError: string;
  }): Promise<string> {
    const requestHeaders = await headers();
    const result = await this.auth().api.signInSocial({
      body: {
        provider: "github",
        callbackURL: paths.returnTo,
        errorCallbackURL: paths.onError,
        disableRedirect: true,
      },
      headers: requestHeaders,
    });
    if (!result.url) {
      throw new Error("Better Auth returned no GitHub authorization URL.");
    }
    return result.url;
  }

  async signOut(): Promise<void> {
    const requestHeaders = await headers();
    await this.auth().api.signOut({ headers: requestHeaders });
  }

  gitHubAppInstallUrl(): string | null {
    return gitHubAppInstallUrl(getEnv().GITHUB_APP_SLUG);
  }
}
