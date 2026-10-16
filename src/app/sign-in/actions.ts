"use server";

import { redirect } from "next/navigation";

import { getAuthenticator } from "@/shared/infrastructure/container";

export async function signInWithGitHubAction(): Promise<void> {
  const url = await getAuthenticator().beginGitHubSignIn({
    returnTo: "/repositories",
    onError: "/sign-in",
  });
  redirect(url);
}

export async function signOutAction(): Promise<void> {
  await getAuthenticator().signOut();
  redirect("/sign-in");
}
