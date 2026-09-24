"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/ssr";

import { formatAbsolute, formatRelativeTime } from "./format";
import { Spinner } from "./spinner";
import { useSync } from "./sync-context";

/**
 * The header's freshness line and its Refresh button. While a sync runs it
 * says so, and the numbers around it stay as they were until it lands. The
 * rate limit is not said here: the banner under the header says it once.
 */
export function SyncStatus({
  syncedAt,
  neverSynced,
  watched,
  now,
}: {
  syncedAt: Date | null;
  neverSynced: number;
  watched: number;
  now: Date;
}) {
  const { syncing, refresh, updating } = useSync();

  return (
    <div className="flex items-center gap-2">
      <p
        role="status"
        aria-live="polite"
        className="text-ink-muted flex items-center gap-1.5 text-[12px]"
      >
        {syncing ? (
          <>
            <Spinner />
            {updating > 1
              ? `Updating ${updating} repositories from GitHub`
              : "Updating from GitHub"}
          </>
        ) : syncedAt === null ? (
          watched === 0 ? null : (
            "Not synced yet"
          )
        ) : (
          <>
            Synced{" "}
            <time
              dateTime={syncedAt.toISOString()}
              title={formatAbsolute(syncedAt)}
              className="text-ink-soft"
            >
              {formatRelativeTime(syncedAt, now)}
            </time>
            {neverSynced > 0 ? `, ${neverSynced} not yet` : null}
          </>
        )}
      </p>
      {watched > 0 ? (
        <button
          type="button"
          onClick={refresh}
          disabled={syncing}
          className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-60"
        >
          <ArrowsClockwise aria-hidden="true" className="size-[15px]" />
          Refresh
        </button>
      ) : null}
    </div>
  );
}

/** A thin bar running along the top of the table while a sync is out. */
export function SyncProgressBar() {
  const { syncing } = useSync();
  if (!syncing) return null;
  return (
    <div
      aria-hidden
      data-testid="sync-progress"
      className="bg-pr-wash absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-t-xl"
    >
      <div className="bg-pr motion-safe:animate-sync-bar h-full w-2/5" />
    </div>
  );
}

/** A row's own sign that its numbers are being refreshed. */
export function RowSyncIndicator({
  repositoryId,
  fullName,
}: {
  repositoryId: string;
  fullName: string;
}) {
  const { isSyncing } = useSync();
  if (!isSyncing(repositoryId)) return null;
  return (
    <span className="flex items-center" title={`Updating ${fullName}`}>
      <Spinner className="size-[13px]" />
      <span className="sr-only">{`Updating ${fullName} from GitHub`}</span>
    </span>
  );
}
