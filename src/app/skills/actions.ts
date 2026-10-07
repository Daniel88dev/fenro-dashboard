"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CreateLabelCommand } from "@/modules/tasks/application/commands/create-label";
import type { CreateSkillCommand } from "@/modules/tasks/application/commands/create-skill";
import type { DeleteSkillCommand } from "@/modules/tasks/application/commands/delete-skill";
import type { LinkSkillCommand } from "@/modules/tasks/application/commands/link-skill";
import type { RecolourLabelCommand } from "@/modules/tasks/application/commands/recolour-label";
import type { RenameLabelCommand } from "@/modules/tasks/application/commands/rename-label";
import type { RestoreSkillCommand } from "@/modules/tasks/application/commands/restore-skill";
import type { ReviseSkillCommand } from "@/modules/tasks/application/commands/revise-skill";
import type { UnlinkSkillCommand } from "@/modules/tasks/application/commands/unlink-skill";
import { skillQuery } from "@/modules/tasks/application/queries/skill";
import {
  isLabelColour,
  normaliseLabelName,
  normaliseSkillName,
  type Actor,
  type TaskError,
} from "@/modules/tasks/domain";
import {
  labelHref,
  skillHref,
  SKILLS_PATH,
} from "@/modules/tasks/ui/skill-views";
import type { TaskFormState } from "@/modules/tasks/ui/task-form-state";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { Result } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/**
 * The Skills & labels screen's actions. Each reads the form, dispatches as
 * the signed-in person, and says what the domain said; the rules on names,
 * lengths and stale revisions are the aggregate's, the same ones agents meet.
 */

type Signed = {
  readonly ownerId: string;
  readonly actor: Actor;
  readonly container: Awaited<ReturnType<typeof getContainer>>;
};

async function signedIn(): Promise<Signed | null> {
  const container = await getContainer();
  const user = await container.queryBus.ask(signedInUserQuery());
  if (!user) return null;
  return {
    ownerId: user.id,
    actor: { kind: "human", id: user.id, name: user.githubLogin },
    container,
  };
}

const SIGNED_OUT = "Sign in with GitHub to change skills and labels.";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const labelsOf = (formData: FormData) =>
  formData
    .getAll("labels")
    .map((value) => String(value).trim())
    .filter(Boolean);

function refused(state: TaskFormState, error: TaskError): TaskFormState {
  return { error: error.message, saved: state.saved };
}

function answer(
  state: TaskFormState,
  outcome: Result<void, TaskError>,
): TaskFormState {
  if (!outcome.ok) return refused(state, outcome.error);
  // A task's brief lists the skills its labels bring, so tasks change too.
  revalidatePath(SKILLS_PATH);
  revalidatePath("/tasks", "layout");
  return { error: null, saved: state.saved + 1 };
}

/**
 * Create a skill, or revise the one named by `skill`. Labels are links, not
 * text, so a revise links the labels the editor added and unlinks the ones
 * it took away, after the text is saved.
 */
export async function saveSkillAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const fields = {
    name: text(formData, "name"),
    description: text(formData, "description"),
    instructions: String(formData.get("instructions") ?? ""),
  };
  const labels = labelsOf(formData).map(normaliseLabelName);
  const id = text(formData, "skill");

  if (!id) {
    const command: CreateSkillCommand = {
      type: "tasks.create-skill",
      ownerId,
      actor,
      skillId: crypto.randomUUID(),
      ...fields,
      labels,
    };
    const created = await container.commandBus.dispatch(command);
    if (!created.ok) return refused(state, created.error);
    revalidatePath(SKILLS_PATH);
    redirect(skillHref(normaliseSkillName(fields.name)));
  }

  const before = await container.queryBus.ask(skillQuery(ownerId, id, 1));
  if (!before.ok) return refused(state, before.error);

  const revise: ReviseSkillCommand = {
    type: "tasks.revise-skill",
    ownerId,
    actor,
    skill: id,
    expectedRevision: Number(text(formData, "revision")),
    ...fields,
  };
  const revised = await container.commandBus.dispatch(revise);
  if (!revised.ok) return refused(state, revised.error);

  const added = labels.filter((name) => !before.value.labels.includes(name));
  const removed = before.value.labels.filter((name) => !labels.includes(name));
  if (added.length > 0) {
    const link: LinkSkillCommand = {
      type: "tasks.link-skill",
      ownerId,
      actor,
      skill: id,
      labels: added,
    };
    const linked = await container.commandBus.dispatch(link);
    if (!linked.ok) return answer(state, linked);
  }
  if (removed.length > 0) {
    const unlink: UnlinkSkillCommand = {
      type: "tasks.unlink-skill",
      ownerId,
      actor,
      skill: id,
      labels: removed,
    };
    const unlinked = await container.commandBus.dispatch(unlink);
    if (!unlinked.ok) return answer(state, unlinked);
  }

  const name = normaliseSkillName(fields.name);
  if (name !== before.value.name) {
    revalidatePath(SKILLS_PATH);
    redirect(skillHref(name));
  }
  return answer(state, revised);
}

export async function restoreSkillAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const command: RestoreSkillCommand = {
    type: "tasks.restore-skill",
    ownerId,
    actor,
    skill: text(formData, "skill"),
    revision: Number(text(formData, "revision")),
    expectedRevision: Number(text(formData, "expectedRevision")),
  };
  const restored = await container.commandBus.dispatch(command);
  if (!restored.ok) return refused(state, restored.error);

  // A restore can bring back an earlier name, which is the skill's address.
  const after = await container.queryBus.ask(
    skillQuery(ownerId, command.skill, 1),
  );
  revalidatePath(SKILLS_PATH);
  revalidatePath("/tasks", "layout");
  redirect(after.ok ? skillHref(after.value.name) : SKILLS_PATH);
}

async function changeLinks(
  state: TaskFormState,
  formData: FormData,
  type: "tasks.link-skill" | "tasks.unlink-skill",
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const command: LinkSkillCommand | UnlinkSkillCommand = {
    type,
    ownerId,
    actor,
    skill: text(formData, "skill"),
    labels: [text(formData, "label")],
  };
  return answer(state, await container.commandBus.dispatch(command));
}

export async function linkSkillAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  return changeLinks(state, formData, "tasks.link-skill");
}

export async function unlinkSkillAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  return changeLinks(state, formData, "tasks.unlink-skill");
}

export async function createLabelAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const command: CreateLabelCommand = {
    type: "tasks.create-label",
    ownerId,
    actor,
    labelId: crypto.randomUUID(),
    name: text(formData, "name"),
  };
  const created = await container.commandBus.dispatch(command);
  if (!created.ok) return refused(state, created.error);
  revalidatePath(SKILLS_PATH);
  redirect(labelHref(normaliseLabelName(command.name)));
}

export async function renameLabelAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const command: RenameLabelCommand = {
    type: "tasks.rename-label",
    ownerId,
    actor,
    label: text(formData, "label"),
    name: text(formData, "name"),
  };
  const renamed = await container.commandBus.dispatch(command);
  if (!renamed.ok) return refused(state, renamed.error);
  revalidatePath(SKILLS_PATH);
  revalidatePath("/tasks", "layout");
  redirect(labelHref(normaliseLabelName(command.name)));
}

export async function recolourLabelAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const colour = text(formData, "colour");
  if (!isLabelColour(colour)) {
    return { error: "Pick one of the nine colours.", saved: state.saved };
  }
  const command: RecolourLabelCommand = {
    type: "tasks.recolour-label",
    ownerId,
    actor,
    label: text(formData, "label"),
    colour,
  };
  return answer(state, await container.commandBus.dispatch(command));
}

export async function deleteSkillAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const command: DeleteSkillCommand = {
    type: "tasks.delete-skill",
    ownerId,
    actor,
    skill: text(formData, "skill"),
  };
  const deleted = await container.commandBus.dispatch(command);
  if (!deleted.ok) return refused(state, deleted.error);
  revalidatePath(SKILLS_PATH);
  revalidatePath("/tasks", "layout");
  redirect(SKILLS_PATH);
}
