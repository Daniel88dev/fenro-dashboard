import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { myGroupsQuery } from "@/modules/groups/application/queries/my-groups";
import { GroupsSection } from "@/modules/groups/ui/groups-section";
import { accessTokensQuery } from "@/modules/identity/application/queries/access-tokens";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { AccountSection } from "@/modules/identity/ui/account-section";
import { AgentAccess } from "@/modules/identity/ui/agent-access";
import { AgentSkills } from "@/modules/identity/ui/agent-skills";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { getEnv } from "@/shared/config/env";
import { getContainer } from "@/shared/infrastructure/container";

import { answerInvitationAction, createGroupAction } from "../groups/actions";
import { signInWithGitHubAction, signOutAction } from "../sign-in/actions";
import { SignedInAccount } from "../signed-in-account";
import { issueAccessTokenAction, revokeAccessTokenAction } from "./actions";

export const metadata = {
  title: "Settings · Fenro Dashboard",
  description:
    "Your groups, the Fenro agent skills, and tokens that let AI agents work on your tasks.",
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
      <div className="flex max-w-[1080px] flex-col gap-7">
        <h1 className="text-ink text-[22px] font-semibold tracking-tight">
          Settings
        </h1>
        <Suspense fallback={null}>
          <SettingsSections />
        </Suspense>
      </div>
    </DashboardChrome>
  );
}

async function SettingsSections() {
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

  const [tokens, { groups, invitations }] = await Promise.all([
    queryBus.ask(accessTokensQuery(user.id)),
    queryBus.ask(myGroupsQuery({ id: user.id, login: user.githubLogin })),
  ]);
  const appUrl = getEnv().APP_URL;
  return (
    <>
      <AccountSection user={user} signOutAction={signOutAction} />
      <GroupsSection
        groups={groups}
        invitations={invitations}
        createAction={createGroupAction}
        answerAction={answerInvitationAction}
      />
      <AgentSkills appUrl={new URL(appUrl).origin} />
      <AgentAccess
        serverUrl={new URL("/api/mcp", appUrl).toString()}
        tokens={tokens}
        issueAction={issueAccessTokenAction}
        revokeAction={revokeAccessTokenAction}
      />
    </>
  );
}
