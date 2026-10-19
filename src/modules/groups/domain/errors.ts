/**
 * Plain objects rather than `Error` subclasses, like the tasks context's, so a
 * refusal can cross the command bus and the RSC boundary.
 */
export type GroupErrorCode =
  | "invalid-group"
  | "group-not-found"
  | "not-an-owner"
  | "prefix-taken"
  | "already-a-member"
  | "already-invited"
  | "invitation-not-found"
  | "member-not-found"
  | "last-owner"
  | "group-has-tasks"
  | "concurrent-modification";

export type GroupError = {
  readonly code: GroupErrorCode;
  readonly message: string;
};

export function groupError(code: GroupErrorCode, message: string): GroupError {
  return { code, message };
}

export function invalidGroup(message: string): GroupError {
  return groupError("invalid-group", message);
}

export function groupNotFound(): GroupError {
  return groupError(
    "group-not-found",
    "There is no such group, or you are not one of its members.",
  );
}

export function prefixTaken(prefix: string): GroupError {
  return groupError(
    "prefix-taken",
    `${prefix} is already used by another group. Pick other letters.`,
  );
}
