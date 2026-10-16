import type {
  Viewer,
  ViewerProvider,
} from "@/modules/github-insights/application/ports/viewer";

export type SignedInAccount = {
  user(): Promise<{ readonly id: string; readonly login: string } | null>;
  accessToken(): Promise<string | null>;
};

export class SignedInViewerProvider implements ViewerProvider {
  constructor(private readonly account: SignedInAccount) {}

  async current(): Promise<Viewer | null> {
    const user = await this.account.user();
    if (!user) return null;

    const accessToken = await this.account.accessToken();
    if (!accessToken) return null;

    return { id: user.id, login: user.login, accessToken };
  }
}
