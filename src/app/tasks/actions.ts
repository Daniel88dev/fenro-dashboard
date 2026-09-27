"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import type { ChangeStatusCommand } from "@/modules/tasks/application/commands/change-status";
import type { CheckCriterionCommand } from "@/modules/tasks/application/commands/check-criterion";
import type { CreateTaskCommand } from "@/modules/tasks/application/commands/create-task";
import type { LinkTasksCommand } from "@/modules/tasks/application/commands/link-tasks";
import type { RecordNoteCommand } from "@/modules/tasks/application/commands/record-note";
import type { RemovePictureCommand } from "@/modules/tasks/application/commands/remove-picture";
import type { UpdateTaskCommand } from "@/modules/tasks/application/commands/update-task";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import {
  LINK_KINDS,
  NOTE_KINDS,
  PRIORITIES,
  type Actor,
  type LinkKind,
  type NoteKind,
  type Priority,
  type StatusTarget,
  type TaskError,
} from "@/modules/tasks/domain";
import type { TaskFormState } from "@/modules/tasks/ui/task-form-state";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { Result } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/**
 * A person working their tasks by hand. Every action is thin: read the form,
 * dispatch one command as the signed-in person, and say what the domain said.
 * The rules — claims, cycles, criteria — are the same ones agents meet.
 */

const STATUS_TARGETS: readonly StatusTarget[] = [
  "backlog",
  "todo",
  "in_review",
  "done",
  "cancelled",
];

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

const SIGNED_OUT = "Sign in with GitHub to change tasks.";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

/** One entry per line, blank lines dropped. */
const lines = (formData: FormData, key: string) =>
  text(formData, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** Keys typed as "T-3, T-7". */
const list = (formData: FormData, key: string) =>
  text(formData, key)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

function answer(
  state: TaskFormState,
  outcome: Result<void, TaskError>,
  task: string,
): TaskFormState {
  if (!outcome.ok) return { error: outcome.error.message, saved: state.saved };
  revalidatePath(`/tasks/${task}`);
  return { error: null, saved: state.saved + 1 };
}

export async function createTaskAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const priority = text(formData, "priority");
  const source = text(formData, "source");
  const taskId = crypto.randomUUID();
  const command: CreateTaskCommand = {
    type: "tasks.create-task",
    ownerId,
    actor,
    taskId,
    title: text(formData, "title"),
    description: text(formData, "description"),
    status: text(formData, "status") === "backlog" ? "backlog" : "todo",
    priority: PRIORITIES.includes(priority as Priority)
      ? (priority as Priority)
      : undefined,
    labels: labelsOf(formData),
    repository: text(formData, "repository") || undefined,
    parent: text(formData, "parent") || undefined,
    criteria: lines(formData, "criteria"),
    references: source ? [{ url: source, isSource: true }] : [],
    blockedBy: list(formData, "blockedBy"),
  };
  const created = await container.commandBus.dispatch(command);
  if (!created.ok) return { error: created.error.message, saved: state.saved };

  const brief = await container.queryBus.ask(
    taskBriefQuery(ownerId, taskId, 0),
  );
  revalidatePath("/tasks");
  // From the dialog, the new task replaces the form in history, so closing
  // it goes back to the page the dialog was opened over.
  redirect(
    brief.ok ? `/tasks/${brief.value.key}` : "/tasks",
    text(formData, "from") === "dialog" ? RedirectType.replace : undefined,
  );
}

export async function updateTaskAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const priority = text(formData, "priority");
  const command: UpdateTaskCommand = {
    type: "tasks.update-task",
    ownerId,
    actor,
    task,
    title: text(formData, "title"),
    description: text(formData, "description"),
    priority: PRIORITIES.includes(priority as Priority)
      ? (priority as Priority)
      : undefined,
    repository: text(formData, "repository") || null,
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

/** The label picker's pick: one `labels` field per name. */
const labelsOf = (formData: FormData) =>
  formData
    .getAll("labels")
    .map((value) => String(value).trim())
    .filter(Boolean);

/** Replaces a task's labels; names not in the owner's labels are added. */
export async function setLabelsAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const command: UpdateTaskCommand = {
    type: "tasks.update-task",
    ownerId,
    actor,
    task,
    labels: labelsOf(formData),
  };
  const outcome = await container.commandBus.dispatch(command);
  if (outcome.ok) revalidatePath("/tasks");
  return answer(state, outcome, task);
}

/** Adds criteria, attaches a link, or detaches one: the smaller edits. */
export async function editTaskAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const attach = text(formData, "attach");
  const detach = text(formData, "detach");
  const removeCriterion = Number(text(formData, "removeCriterion"));
  const command: UpdateTaskCommand = {
    type: "tasks.update-task",
    ownerId,
    actor,
    task,
    addCriteria: lines(formData, "criteria"),
    removeCriteria: removeCriterion > 0 ? [removeCriterion] : undefined,
    attach: attach
      ? [{ url: attach, isSource: formData.get("isSource") === "on" }]
      : undefined,
    detach: detach ? [detach] : undefined,
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function recordNoteAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const kind = text(formData, "kind") as NoteKind;
  const command: RecordNoteCommand = {
    type: "tasks.record-note",
    ownerId,
    actor,
    task,
    kind: NOTE_KINDS.includes(kind) ? kind : "note",
    text: text(formData, "text"),
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function checkCriterionAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const command: CheckCriterionCommand = {
    type: "tasks.check-criterion",
    ownerId,
    actor,
    task,
    criterion: Number(text(formData, "criterion")),
    met: text(formData, "met") === "true",
    evidence: text(formData, "evidence") || null,
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function changeStatusAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const status = text(formData, "status") as StatusTarget;
  const hold = formData.has("hold") ? text(formData, "hold") : undefined;
  const command: ChangeStatusCommand = {
    type: "tasks.change-status",
    ownerId,
    actor,
    task,
    status: STATUS_TARGETS.includes(status) ? status : undefined,
    // An empty reason is how the form says "release the hold".
    hold: hold === undefined ? undefined : hold || null,
  };
  const outcome = await container.commandBus.dispatch(command);
  if (outcome.ok) revalidatePath("/tasks");
  return answer(state, outcome, task);
}

export async function linkTasksAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const kind = text(formData, "kind") as LinkKind;
  if (!LINK_KINDS.includes(kind)) {
    return { error: "Pick how the tasks relate.", saved: state.saved };
  }
  const command: LinkTasksCommand = {
    type: "tasks.link-tasks",
    ownerId,
    actor,
    task,
    kind,
    target: text(formData, "target"),
    remove: formData.get("remove") === "true",
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function removePictureAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { ownerId, actor, container } = session;

  const task = text(formData, "task");
  const command: RemovePictureCommand = {
    type: "tasks.remove-picture",
    ownerId,
    actor,
    picture: text(formData, "picture"),
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}
