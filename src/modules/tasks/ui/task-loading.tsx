/** What a tasks screen shows while it reads the database. */
export function TaskLoading({ what }: { what: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-hairline bg-surface text-ink-muted rounded-xl border px-[18px] py-10 text-[13px]"
    >
      {`Loading ${what}…`}
    </div>
  );
}
