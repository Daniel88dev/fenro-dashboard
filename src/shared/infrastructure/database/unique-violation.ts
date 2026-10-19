const UNIQUE_VIOLATION = "23505";

// Drizzle wraps the node-postgres error, so the code may be on a `cause`.
export function isUniqueViolation(error: unknown): boolean {
  for (
    let current: unknown = error;
    current && typeof current === "object";
    current = (current as { cause?: unknown }).cause
  ) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}
