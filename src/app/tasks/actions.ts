"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import type { ChangeStatusCommand } from "@/modules/tasks/application/commands/change-status";
import type { CheckCriterionCommand } from "@/modules/tasks/application/commands/check-criterion";
import type { CreateTaskCommand } from "@/modules/tasks/application/commands/create-task";
import type { LinkTasksCommand } from "@/modules/tasks/application/commands/link-tasks";
import type { RecordNoteCommand } from "@/modules/tasks/application/commands/record-note";
import type { AnswerQuestionnaireCommand } from "@/modules/tasks/application/commands/questionnaire-commands";
import type { RemovePictureCommand } from "@/modules/tasks/application/commands/remove-picture";
import type { UpdateTaskCommand } from "@/modules/tasks/application/commands/update-task";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import {
  LINK_KINDS,
  NOTE_KINDS,
  PRIORITIES,
  isTaskKind,
  PERSONAL_KEY_PREFIX,
  spaceWithPrefix,
  type Actor,
  type AnswerDraft,
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

import { spacesOf, type Spaces } from "./spaces";

const STATUS_TARGETS: readonly StatusTarget[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
];

type Signed = {
  readonly spaces: Spaces;
  readonly actor: Actor;
  readonly container: Awaited<ReturnType<typeof getContainer>>;
};

async function signedIn(): Promise<Signed | null> {
  const container = await getContainer();
  const user = await container.queryBus.ask(signedInUserQuery());
  if (!user) return null;
  return {
    spaces: await spacesOf(container.queryBus, user),
    actor: { kind: "human", id: user.id, name: user.githubLogin },
    container,
  };
}

const SIGNED_OUT = "Sign in with GitHub to change tasks.";

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

const lines = (formData: FormData, key: string) =>
  text(formData, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
  const { spaces, actor, container } = session;
  const space = spaceWithPrefix(
    spaces.all,
    text(formData, "space") || PERSONAL_KEY_PREFIX,
  );
  if (!space) {
    return {
      error: "You are no longer a member of that group.",
      saved: state.saved,
    };
  }
  const ownerId = space.ownerId;

  const priority = text(formData, "priority");
  const source = text(formData, "source");
  const taskId = crypto.randomUUID();
  const command: CreateTaskCommand = {
    type: "tasks.create-task",
    ownerId,
    keyPrefix: space.prefix,
    actor,
    taskId,
    kind: text(formData, "kind") === "epic" ? "epic" : "task",
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
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
  const priority = text(formData, "priority");
  const kind = text(formData, "kind");
  const command: UpdateTaskCommand = {
    type: "tasks.update-task",
    ownerId,
    actor,
    task,
    kind: isTaskKind(kind) ? kind : undefined,
    title: text(formData, "title"),
    description: text(formData, "description"),
    priority: PRIORITIES.includes(priority as Priority)
      ? (priority as Priority)
      : undefined,
    repository: text(formData, "repository") || null,
    // Only a form that shows the parent picker may move the task.
    parent: formData.has("parent")
      ? text(formData, "parent") || null
      : undefined,
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function changeKindAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
  const kind = text(formData, "kind");
  if (!isTaskKind(kind)) {
    return { error: "Pick task or epic.", saved: state.saved };
  }
  const command: UpdateTaskCommand = {
    type: "tasks.update-task",
    ownerId,
    actor,
    task,
    kind,
    parent: formData.has("parent") ? null : undefined,
  };
  const outcome = await container.commandBus.dispatch(command);
  if (outcome.ok) revalidatePath("/tasks");
  return answer(state, outcome, task);
}

const labelsOf = (formData: FormData) =>
  formData
    .getAll("labels")
    .map((value) => String(value).trim())
    .filter(Boolean);

export async function setLabelsAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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

export async function editTaskAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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

export async function moveTaskAction(
  task: string,
  status: string,
): Promise<{ readonly error: string | null }> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT };
  const { spaces, actor, container } = session;
  const ownerId = spaces.ownerOf(task);

  const target = STATUS_TARGETS.find((candidate) => candidate === status);
  if (!target) return { error: "Pick a column to move the task to." };
  const command: ChangeStatusCommand = {
    type: "tasks.change-status",
    ownerId,
    actor,
    task,
    status: target,
  };
  const outcome = await container.commandBus.dispatch(command);
  if (!outcome.ok) return { error: outcome.error.message };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${task}`);
  return { error: null };
}

export async function linkTasksAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
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
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const ownerId = spaces.ownerOf(task);
  const command: RemovePictureCommand = {
    type: "tasks.remove-picture",
    ownerId,
    actor,
    picture: text(formData, "picture"),
  };
  return answer(state, await container.commandBus.dispatch(command), task);
}

export async function answerQuestionnaireAction(
  state: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await signedIn();
  if (!session) return { error: SIGNED_OUT, saved: state.saved };
  const { spaces, actor, container } = session;

  const task = text(formData, "task");
  const command: AnswerQuestionnaireCommand = {
    type: "tasks.answer-questionnaire",
    ownerId: spaces.ownerOf(task),
    actor,
    task,
    round: Number(text(formData, "round")),
    answers: answersOf(text(formData, "answers")),
  };
  const outcome = await container.commandBus.dispatch(command);
  if (outcome.ok) revalidatePath("/tasks");
  return answer(state, outcome, task);
}

function answersOf(json: string): AnswerDraft[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (typeof item !== "object" || item === null) return [];
      const { questionId, choices, text, pictures } = item as Record<
        string,
        unknown
      >;
      if (typeof questionId !== "string") return [];
      const strings = (value: unknown) =>
        Array.isArray(value)
          ? value.filter((entry): entry is string => typeof entry === "string")
          : [];
      return [
        {
          questionId,
          choices: strings(choices),
          text: typeof text === "string" ? text : null,
          pictures: strings(pictures),
        },
      ];
    });
  } catch {
    return [];
  }
}
