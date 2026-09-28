import { err, ok, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

const KEY = /^(?:T-|#)?(\d{1,9})$/i;

/** A task page's address, on any host: `https://…/tasks/T-12`. */
const LINK = /^(?:https?:\/\/[^/\s]+)?\/tasks\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

/**
 * The short, per-person number a task is known by: `T-12`. Agents and people
 * both quote keys far more reliably than UUIDs, and a key stays the same when
 * everything else about the task changes.
 */
export function formatTaskKey(number: number): string {
  return `T-${number}`;
}

/**
 * Accepts `T-12`, `t-12`, `#12` and `12`, and the task's link as the Copy
 * link button gives it, so a person can paste either to an agent.
 */
export function parseTaskKey(value: string): Result<number, TaskError> {
  const link = LINK.exec(value.trim());
  const match = KEY.exec(link ? link[1]! : value.trim());
  const number = match ? Number(match[1]) : 0;
  if (number < 1) {
    return err(
      invalidTask(`"${value.trim()}" is not a task key. Keys look like T-12.`),
    );
  }
  return ok(number);
}
