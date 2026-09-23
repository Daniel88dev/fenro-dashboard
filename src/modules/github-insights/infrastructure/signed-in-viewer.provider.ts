import type {
  Viewer,
  ViewerProvider,
} from "@/modules/github-insights/application/ports/viewer";

/** The two facts this context needs from whoever handles sign-in. */
export type SignedInAccount = {
  user(): Promise<{ readonly id: string; readonly login: string } | null>;
  accessToken(): Promise<string | null>;
};

/**
 * The viewer is whoever signed in with GitHub. This context does not know how
 * sign-in works; the composition root hands it the account as two questions,
 * so the identity context stays out of this one's imports.
 */
export class SignedInViewerProvider implements ViewerProvider {
  constructor(private readonly account: SignedInAccount) {}

  async current(): Promise<Viewer | null> {
    const user = await this.account.user();
    if (!user) return null;

    // Without a token there is nobody GitHub will answer for, so no viewer.
    const accessToken = await this.account.accessToken();
    if (!accessToken) return null;

    return { id: user.id, login: user.login, accessToken };
  }
}
