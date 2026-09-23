import { err, ok, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

const KEY = /^(?:T-|#)?(\d{1,9})$/i;

/**
 * The short, per-person number a task is known by: `T-12`. Agents and people
 * both quote keys far more reliably than UUIDs, and a key stays the same when
 * everything else about the task changes.
 */
export function formatTaskKey(number: number): string {
  return `T-${number}`;
}

/** Accepts `T-12`, `t-12`, `#12` and `12`. */
export function parseTaskKey(value: string): Result<number, TaskError> {
  const match = KEY.exec(value.trim());
  const number = match ? Number(match[1]) : 0;
  if (number < 1) {
    return err(
      invalidTask(`"${value.trim()}" is not a task key. Keys look like T-12.`),
    );
  }
  return ok(number);
}
