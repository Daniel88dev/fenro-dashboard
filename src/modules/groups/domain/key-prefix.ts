import { err, ok, type Result } from "@/shared/domain";

import { invalidGroup, type GroupError } from "./errors";

export const KEY_PREFIX_MIN = 2;
export const KEY_PREFIX_MAX = 5;

const PREFIX = /^[A-Z]{2,5}$/;

/**
 * The letters in front of a group's task keys, as in HAL-12. At least
 * two letters, so it can never be T, which personal tasks use.
 */
export function parseKeyPrefix(value: string): Result<string, GroupError> {
  const prefix = value.trim().toUpperCase();
  if (!PREFIX.test(prefix)) {
    return err(
      invalidGroup(
        `Use ${KEY_PREFIX_MIN} to ${KEY_PREFIX_MAX} letters A to Z for the task key prefix.`,
      ),
    );
  }
  return ok(prefix);
}

export function suggestKeyPrefix(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}
