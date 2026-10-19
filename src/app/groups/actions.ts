"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createGroupCommand } from "@/modules/groups/application/commands/create-group";
import type { DeleteGroupCommand } from "@/modules/groups/application/commands/delete-group";
import type {
  AcceptInvitationCommand,
  CancelInvitationCommand,
  ChangeMemberRoleCommand,
  DeclineInvitationCommand,
  InviteMemberCommand,
  RemoveMemberCommand,
} from "@/modules/groups/application/commands/membership-commands";
import { isRole, type GroupError, type Person } from "@/modules/groups/domain";
import type { GroupFormState } from "@/modules/groups/ui/group-form-state";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { Result } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

const SIGNED_OUT = "Sign in with GitHub to manage groups.";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

async function signedIn() {
  const container = await getContainer();
  const user = await container.queryBus.ask(signedInUserQuery());
  if (!user) return null;
  const person: Person = { id: user.id, login: user.githubLogin };
  return { container, person };
}

function answer(
  state: GroupFormState,
  outcome: Result<void, GroupError>,
  prefix?: string,
): GroupFormState {
  if (!outcome.ok) return { error: outcome.error.message, saved: state.saved };
  revalidatePath("/settings");
  revalidatePath("/tasks");
  if (prefix) revalidatePath(`/groups/${prefix}`);
  return { error: null, saved: state.saved + 1 };
}

export async function createGroupAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };

  const prefix = text(formData, "prefix").toUpperCase();
  const created = await session.container.commandBus.dispatch(
    createGroupCommand({
      groupId: crypto.randomUUID(),
      name: text(formData, "name"),
      prefix,
      by: session.person,
    }),
  );
  if (!created.ok) return { error: created.error.message, saved: state.saved };
  revalidatePath("/settings");
  revalidatePath("/tasks");
  redirect(`/groups/${prefix}`);
}

export async function inviteMemberAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const command: InviteMemberCommand = {
    type: "groups.invite-member",
    groupId: text(formData, "group"),
    by: session.person,
    login: text(formData, "login"),
  };
  return answer(
    state,
    await session.container.commandBus.dispatch(command),
    text(formData, "prefix"),
  );
}

export async function answerInvitationAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const groupId = text(formData, "group");
  const command: AcceptInvitationCommand | DeclineInvitationCommand =
    text(formData, "answer") === "join"
      ? { type: "groups.accept-invitation", groupId, by: session.person }
      : { type: "groups.decline-invitation", groupId, by: session.person };
  return answer(state, await session.container.commandBus.dispatch(command));
}

export async function cancelInvitationAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const command: CancelInvitationCommand = {
    type: "groups.cancel-invitation",
    groupId: text(formData, "group"),
    by: session.person,
    login: text(formData, "login"),
  };
  return answer(
    state,
    await session.container.commandBus.dispatch(command),
    text(formData, "prefix"),
  );
}

export async function changeMemberRoleAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const role = text(formData, "role");
  if (!isRole(role))
    return { error: "Pick owner or member.", saved: state.saved };
  const command: ChangeMemberRoleCommand = {
    type: "groups.change-member-role",
    groupId: text(formData, "group"),
    by: session.person,
    userId: text(formData, "user"),
    role,
  };
  return answer(
    state,
    await session.container.commandBus.dispatch(command),
    text(formData, "prefix"),
  );
}

export async function removeMemberAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const userId = text(formData, "user");
  const command: RemoveMemberCommand = {
    type: "groups.remove-member",
    groupId: text(formData, "group"),
    by: session.person,
    userId,
  };
  const outcome = await session.container.commandBus.dispatch(command);
  if (outcome.ok && userId === session.person.id) {
    revalidatePath("/settings");
    revalidatePath("/tasks");
    redirect("/settings#groups");
  }
  return answer(state, outcome, text(formData, "prefix"));
}

export async function deleteGroupAction(
  state: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const command: DeleteGroupCommand = {
    type: "groups.delete-group",
    groupId: text(formData, "group"),
    by: session.person,
  };
  const outcome = await session.container.commandBus.dispatch(command);
  if (!outcome.ok) return { error: outcome.error.message, saved: state.saved };
  revalidatePath("/settings");
  revalidatePath("/tasks");
  redirect("/settings#groups");
}
