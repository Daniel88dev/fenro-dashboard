/**
 * Why the tasks domain refused something. Plain objects rather than `Error`
 * subclasses, as in github-insights: a refusal crosses the command bus, the MCP
 * server and React Server Component boundaries, and a class instance cannot.
 *
 * The messages are written for whoever reads them next — usually an agent — so
 * each says what to do instead, not only what went wrong.
 */
export type TaskErrorCode =
  | "invalid-task"
  | "task-not-found"
  | "task-claimed"
  | "task-blocked"
  | "task-on-hold"
  | "open-subtasks"
  | "unmet-criteria"
  | "invalid-transition"
  | "dependency-cycle"
  | "no-live-session"
  | "concurrent-modification";

export type TaskError = {
  readonly code: TaskErrorCode;
  readonly message: string;
};

export function taskError(code: TaskErrorCode, message: string): TaskError {
  return { code, message };
}

export function invalidTask(message: string): TaskError {
  return taskError("invalid-task", message);
}

export function taskNotFound(reference: string): TaskError {
  return taskError(
    "task-not-found",
    `There is no task ${reference}. List tasks to find its key.`,
  );
}
