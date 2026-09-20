const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "26 min ago", "1 h ago", "3 d ago" — the table's Last activity column. */
export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}

/** "51 d", "9 h" — how old a pull request or an issue is. */
export function formatAge(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < HOUR) return `${Math.max(1, Math.floor(elapsed / MINUTE))} min`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`;
  return `${Math.floor(elapsed / DAY)} d`;
}

/** What a screen reader and a hover both get instead of "26 min ago". */
export function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
