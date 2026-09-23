import {
  parseTaskKey,
  taskError,
  taskNotFound,
  type Actor,
  type Task,
  type TaskError,
  type TaskGraph,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { Command } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

/**
 * What every tasks command carries: whose task list it acts on, and who is
 * acting. The owner comes from the signed-in person or the access token, never
 * from the agent's own arguments.
 */
export type TaskCommand<TType extends string> = Command<TType, TaskError> & {
  readonly ownerId: string;
  readonly actor: Actor;
};

/** A task named the way people and agents name it: `T-12`, or its id. */
export type TaskReference = string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findTask(
  tasks: TaskRepository,
  ownerId: string,
  reference: TaskReference,
): Promise<Result<Task, TaskError>> {
  const trimmed = reference.trim();
  if (UUID.test(trimmed)) {
    const task = await tasks.findById(ownerId, trimmed.toLowerCase());
    return task ? ok(task) : err(taskNotFound(trimmed));
  }
  const number = parseTaskKey(trimmed);
  if (!number.ok) return number;
  const task = await tasks.findByNumber(ownerId, number.value);
  return task ? ok(task) : err(taskNotFound(trimmed));
}

/** How many times a change is retried when another request saved first. */
const ATTEMPTS = 3;

/**
 * Load a task, change it, save it — and when another request saved the same
 * task in between, do it all again on the fresh copy. Two agents noting on one
 * task at once both land; neither sees an error it could do nothing about.
 */
export async function changeTask(
  tasks: TaskRepository,
  ownerId: string,
  reference: TaskReference,
  change: (
    task: Task,
    graph: () => Promise<TaskGraph>,
  ) => Promise<Result<void, TaskError>> | Result<void, TaskError>,
): Promise<Result<void, TaskError>> {
  let last: TaskError = taskError(
    "concurrent-modification",
    `${reference} kept changing while this was being saved. Try again.`,
  );
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const found = await findTask(tasks, ownerId, reference);
    if (!found.ok) return found;

    let graph: TaskGraph | undefined;
    const changed = await change(found.value, async () => {
      graph ??= await tasks.graph(ownerId);
      return graph;
    });
    if (!changed.ok) return changed;

    const saved = await tasks.save(found.value);
    if (saved.ok || saved.error.code !== "concurrent-modification") {
      return saved;
    }
    last = saved.error;
  }
  return err(last);
}
