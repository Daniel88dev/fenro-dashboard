import { redirect } from "next/navigation";

import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import {
  SignInPanel,
  signInErrorMessage,
} from "@/modules/identity/ui/sign-in-panel";
import { getContainer } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "./actions";

export const metadata = {
  title: "Sign in · Fenro Dashboard",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { queryBus } = await getContainer();
  if (await queryBus.ask(signedInUserQuery())) redirect("/repositories");

  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;

  return (
    <div className="bg-ground flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 font-sans">
      <SignInPanel
        heading="Sign in to Fenro"
        action={signInWithGitHubAction}
        error={signInErrorMessage(code)}
      />
    </div>
  );
}
