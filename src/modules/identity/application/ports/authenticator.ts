/**
 * Who is signed in, as the rest of the app needs to know it. GitHub is the only
 * way in, so every signed-in user has a GitHub login.
 */
export type SignedInUser = {
  readonly id: string;
  readonly name: string;
  readonly githubLogin: string;
  readonly image: string | null;
};

/**
 * The sign-in machinery, behind a port so nothing outside `infrastructure/`
 * knows it is Better Auth. Every method reads the current request, so call
 * them from a route, a server action or the composition root — never from
 * inside a `use cache` scope (docs/research/nextjs-16-rendering-strategy.md).
 */
export interface Authenticator {
  signedInUser(): Promise<SignedInUser | null>;

  /**
   * The signed-in user's GitHub OAuth token, for reading GitHub on their
   * behalf. `null` when nobody is signed in. A grant revoked on GitHub still
   * returns the stored token; GitHub's 401 is what reports it.
   */
  gitHubAccessToken(): Promise<string | null>;

  /**
   * Starts the OAuth dance and returns the GitHub URL to send the browser to.
   * GitHub comes back to `returnTo` on success and to `onError` with an
   * `?error=` code otherwise.
   */
  beginGitHubSignIn(paths: {
    returnTo: string;
    onError: string;
  }): Promise<string>;

  signOut(): Promise<void>;

  /**
   * GitHub's page where the user reviews what this app may read, and asks an
   * organization to let it in. `null` when no OAuth app is configured.
   */
  gitHubAccessSettingsUrl(): string | null;
}
