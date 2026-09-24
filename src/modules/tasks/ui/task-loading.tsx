import { Spinner } from "@/modules/github-insights/ui/spinner";

/** What a tasks screen shows while it reads the database. */
export function TaskLoading({ what }: { what: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-hairline bg-surface text-ink-muted flex items-center gap-2 rounded-xl border px-[18px] py-10 text-[13px]"
    >
      <Spinner className="size-4" />
      {`Loading ${what}…`}
    </div>
  );
}
