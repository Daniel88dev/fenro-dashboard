// Plain objects rather than `Error` subclasses: a `Result` from a query
// handler crosses a React Server Component boundary, and a class instance
// cannot.
export type InvalidCoordinates = {
  readonly code: "invalid-coordinates";
  readonly message: string;
};

export function invalidCoordinates(message: string): InvalidCoordinates {
  return { code: "invalid-coordinates", message };
}

export type SyncRefusalReason =
  "in-progress" | "not-due" | "cooling-down" | "not-connected";

export type SyncRefused = {
  readonly code: "sync-refused";
  readonly reason: SyncRefusalReason;
  readonly message: string;
};

export function syncRefused(
  reason: SyncRefusalReason,
  message: string,
): SyncRefused {
  return { code: "sync-refused", reason, message };
}

export type AlreadyWatched = {
  readonly code: "already-watched";
  readonly message: string;
};

export function alreadyWatched(message: string): AlreadyWatched {
  return { code: "already-watched", message };
}
