"use client";

import { formatAbsolute, formatRelativeTime } from "./format";
import { useSync } from "./sync-context";

function Spinner() {
  return (
    <span
      aria-hidden
      className="border-hairline border-t-pr inline-block size-3 shrink-0 rounded-full border-2 motion-safe:animate-spin"
    />
  );
}

/**
 * The header's freshness line and its Refresh button. While a sync runs it
 * says so, and the numbers around it stay as they were until it lands.
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
  const { syncing, refresh } = useSync();

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
            Updating from GitHub…
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
          className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr h-[34px] cursor-pointer rounded-[9px] border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-60"
        >
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
      className="bg-pr-wash absolute inset-x-0 top-0 h-0.5 overflow-hidden"
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
      <Spinner />
      <span className="sr-only">{`Updating ${fullName} from GitHub`}</span>
    </span>
  );
}
