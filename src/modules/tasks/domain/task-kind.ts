/**
 * What sort of work a task is. A plain task is what an agent or a person
 * works on. An epic is a larger piece of work that holds tasks: it sits at the
 * top, has no parent of its own, and is done when what it holds is done.
 *
 * Membership is the parent relation every task already has, so an epic's
 * tasks are its sub-tasks and the rules about open sub-tasks apply to it as
 * they are.
 */
export const TASK_KINDS = ["task", "epic"] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

export function isTaskKind(value: string): value is TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value);
}
