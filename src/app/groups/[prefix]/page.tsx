import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { groupQuery } from "@/modules/groups/application/queries/group";
import { GroupMembers } from "@/modules/groups/ui/group-members";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { getContainer } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import {
  cancelInvitationAction,
  changeMemberRoleAction,
  deleteGroupAction,
  inviteMemberAction,
  removeMemberAction,
} from "../actions";

export const metadata = {
  title: "Group · Fenro Dashboard",
};

export default function GroupPage({ params }: PageProps<"/groups/[prefix]">) {
  return (
    <DashboardChrome
      current="settings"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<TaskLoading what="the group" />}>
        <GroupScreen params={params} />
      </Suspense>
    </DashboardChrome>
  );
}

async function GroupScreen({
  params,
}: {
  params: PageProps<"/groups/[prefix]">["params"];
}) {
  const { prefix } = await params;
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return (
      <SignInPanel
        heading="Sign in to see this group"
        action={signInWithGitHubAction}
      />
    );
  }

  const group = await queryBus.ask(groupQuery(prefix, user.id));
  if (!group.ok) notFound();
  return (
    <GroupMembers
      group={group.value}
      you={user.id}
      actions={{
        invite: inviteMemberAction,
        cancelInvitation: cancelInvitationAction,
        changeRole: changeMemberRoleAction,
        remove: removeMemberAction,
        delete: deleteGroupAction,
      }}
    />
  );
}
