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

/**
 * Maps Better Auth's user onto the port's. A user without a GitHub login can
 * only be a row written before the login was captured; treating it as signed
 * out sends them through sign-in once more, which fills it in.
 */
export function toSignedInUser(user: SessionUser): SignedInUser | null {
  if (!user.githubLogin) return null;
  return {
    id: user.id,
    name: user.name,
    githubLogin: user.githubLogin,
    image: user.image ?? null,
  };
}

/**
 * An organization with OAuth app access restrictions hides its repositories
 * from this app until an owner approves it; this page is where a member asks.
 */
export function gitHubAccessSettingsUrl(
  clientId: string | undefined,
): string | null {
  return clientId
    ? `https://github.com/settings/connections/applications/${encodeURIComponent(clientId)}`
    : null;
}

export class BetterAuthAuthenticator implements Authenticator {
  /**
   * One session lookup per request, however many components and the
   * composition root ask. React's `cache` is scoped to the request.
   *
   * `headers()` comes first on purpose: it is what tells `next build` the page
   * is per request, so the build stops there instead of trying to create
   * Better Auth without its settings.
   */
  readonly #session = cache(async () => {
    const requestHeaders = await headers();
    return this.auth().api.getSession({ headers: requestHeaders });
  });

  /** Per request too: the top bar and the table both build a container. */
  readonly #gitHubAccessToken = cache(async (): Promise<string | null> => {
    const session = await this.#session();
    if (!session) return null;

    const requestHeaders = await headers();
    const accounts = await this.auth().api.listUserAccounts({
      headers: requestHeaders,
    });
    const github = accounts.find((account) => account.providerId === "github");
    if (!github) return null;

    const token = await this.auth().api.getAccessToken({
      body: { accountId: github.id },
      headers: requestHeaders,
    });
    return token.accessToken || null;
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

  gitHubAccessSettingsUrl(): string | null {
    return gitHubAccessSettingsUrl(getEnv().GITHUB_CLIENT_ID);
  }
}
