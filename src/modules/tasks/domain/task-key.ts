import { err, ok, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

export const PERSONAL_KEY_PREFIX = "T";

const KEY = /^(?:([a-z]{1,5})-|#)?(\d{1,9})$/i;

const LINK = /^(?:https?:\/\/[^/\s]+)?\/tasks\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

export type TaskKey = {
  /** Upper case, or null when the reference was a bare number. */
  readonly prefix: string | null;
  readonly number: number;
};

export function formatTaskKey(
  number: number,
  prefix: string = PERSONAL_KEY_PREFIX,
): string {
  return `${prefix}-${number}`;
}

export function readTaskKey(value: string): Result<TaskKey, TaskError> {
  const link = LINK.exec(value.trim());
  const match = KEY.exec(link ? link[1]! : value.trim());
  const number = match ? Number(match[2]) : 0;
  if (number < 1) {
    return err(
      invalidTask(`"${value.trim()}" is not a task key. Keys look like T-12.`),
    );
  }
  return ok({ prefix: match![1]?.toUpperCase() ?? null, number });
}

export function parseTaskKey(value: string): Result<number, TaskError> {
  const key = readTaskKey(value);
  return key.ok ? ok(key.value.number) : key;
}

/** A bare number or `#12` names a task in whichever space it is read in. */
export function keyMatches(key: TaskKey, prefix: string): boolean {
  return key.prefix === null || key.prefix === prefix;
}
