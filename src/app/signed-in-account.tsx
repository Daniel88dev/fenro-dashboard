import { SavedThemeToggle } from "@/modules/github-insights/ui/saved-theme-toggle";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { AccountMenu } from "@/modules/identity/ui/account-menu";
import { getContainer } from "@/shared/infrastructure/container";

import { signOutAction } from "./sign-in/actions";

export async function SignedInAccount() {
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return null;

  return (
    <AccountMenu
      user={user}
      signOutAction={signOutAction}
      themeToggle={<SavedThemeToggle tone="menu" />}
    />
  );
}
