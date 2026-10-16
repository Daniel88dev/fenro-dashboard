const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}

export function formatAge(date: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - date.getTime());

  if (elapsed < HOUR) return `${Math.max(1, Math.floor(elapsed / MINUTE))} min`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`;
  return `${Math.floor(elapsed / DAY)} d`;
}

export function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
