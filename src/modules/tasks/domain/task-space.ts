import { PERSONAL_KEY_PREFIX, readTaskKey } from "./task-key";

/**
 * Where a task lives: a person's own tasks, or a group's, which every
 * member shares. The owner numbers its tasks; the prefix starts their keys.
 */
export type TaskSpace = {
  readonly ownerId: string;
  readonly prefix: string;
  readonly name: string;
  readonly kind: "personal" | "group";
};

/** Someone a group task can be assigned to; the login is kept for display. */
export type SpaceMember = {
  readonly userId: string;
  readonly login: string;
};

export function personalSpace(userId: string): TaskSpace {
  return {
    ownerId: userId,
    prefix: PERSONAL_KEY_PREFIX,
    name: "Personal",
    kind: "personal",
  };
}

/** A bare number or a task id stays in the reader's personal space. */
export function spaceOfTask(
  spaces: readonly TaskSpace[],
  reference: string,
): TaskSpace | undefined {
  const key = readTaskKey(reference);
  const prefix = key.ok && key.value.prefix ? key.value.prefix : null;
  return prefix
    ? spaces.find((space) => space.prefix === prefix)
    : spaces.find((space) => space.kind === "personal");
}

export function spaceWithPrefix(
  spaces: readonly TaskSpace[],
  prefix: string,
): TaskSpace | undefined {
  const wanted = prefix.trim().toUpperCase();
  return spaces.find((space) => space.prefix === wanted);
}
