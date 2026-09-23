/**
 * Domain failures are plain objects rather than `Error` subclasses: a `Result`
 * returned by a query handler crosses a React Server Component boundary, and a
 * class instance cannot. See docs/research/nextjs-16-rendering-strategy.md.
 */
export type InvalidCoordinates = {
  readonly code: "invalid-coordinates";
  readonly message: string;
};

export function invalidCoordinates(message: string): InvalidCoordinates {
  return { code: "invalid-coordinates", message };
}

/** Why a sync may not start now. None of these is an error to show anyone. */
export type SyncRefusalReason = "in-progress" | "not-due" | "cooling-down";

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
