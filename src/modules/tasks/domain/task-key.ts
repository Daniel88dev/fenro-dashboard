import { err, ok, type Result } from "@/shared/domain";

import { invalidTask, type TaskError } from "./errors";

const KEY = /^(?:T-|#)?(\d{1,9})$/i;

const LINK = /^(?:https?:\/\/[^/\s]+)?\/tasks\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

export function formatTaskKey(number: number): string {
  return `T-${number}`;
}

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
