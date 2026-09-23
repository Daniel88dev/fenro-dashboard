"use server";

import { redirect } from "next/navigation";

import { getAuthenticator } from "@/shared/infrastructure/container";

/** Sends the browser to GitHub, which sends it back to the dashboard. */
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
