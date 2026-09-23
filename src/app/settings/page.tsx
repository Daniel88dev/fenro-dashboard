import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { accessTokensQuery } from "@/modules/identity/application/queries/access-tokens";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { AgentAccess } from "@/modules/identity/ui/agent-access";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { getEnv } from "@/shared/config/env";
import { getContainer } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../sign-in/actions";
import { SignedInAccount } from "../signed-in-account";
import { issueAccessTokenAction, revokeAccessTokenAction } from "./actions";

export const metadata = {
  title: "Settings · Fenro Dashboard",
  description: "Tokens that let AI agents work on your tasks.",
};

export default function SettingsPage() {
  return (
    <DashboardChrome
      current="settings"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <h1 className="text-ink text-[20px] font-semibold tracking-tight">
        Settings
      </h1>
      <Suspense fallback={null}>
        <AgentAccessSection />
      </Suspense>
    </DashboardChrome>
  );
}

async function AgentAccessSection() {
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return (
      <SignInPanel
        heading="Sign in to manage agent access"
        action={signInWithGitHubAction}
      />
    );
  }

  const tokens = await queryBus.ask(accessTokensQuery(user.id));
  return (
    <AgentAccess
      serverUrl={new URL("/api/mcp", getEnv().APP_URL).toString()}
      tokens={tokens}
      issueAction={issueAccessTokenAction}
      revokeAction={revokeAccessTokenAction}
    />
  );
}
