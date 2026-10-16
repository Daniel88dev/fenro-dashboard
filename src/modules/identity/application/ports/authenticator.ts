export type SignedInUser = {
  readonly id: string;
  readonly name: string;
  readonly githubLogin: string;
  readonly image: string | null;
};

// Every method reads the current request: never call one inside a `use cache`
// scope.
export interface Authenticator {
  signedInUser(): Promise<SignedInUser | null>;

  // A grant revoked on GitHub still returns the stored token; GitHub's 401 is
  // what reports it.
  gitHubAccessToken(): Promise<string | null>;

  beginGitHubSignIn(paths: {
    returnTo: string;
    onError: string;
  }): Promise<string>;

  signOut(): Promise<void>;

  gitHubAppInstallUrl(): string | null;
}
