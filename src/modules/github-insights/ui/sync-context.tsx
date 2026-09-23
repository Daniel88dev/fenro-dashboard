"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type { SyncTrigger } from "@/modules/github-insights/domain";

export type SyncAction = (trigger: SyncTrigger) => Promise<void>;

type SyncContextValue = {
  /** A sync is running: the numbers on screen are about to change. */
  readonly syncing: boolean;
  /** The rows this sync is expected to touch, for their own indicator. */
  readonly isSyncing: (repositoryId: string) => boolean;
  readonly refresh: () => void;
};

const SyncContext = createContext<SyncContextValue>({
  syncing: false,
  isSyncing: () => false,
  refresh: () => {},
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

/**
 * The page renders what the database holds; this starts the refresh from
 * GitHub once that page is on screen. When rows are due — never synced, or
 * older than an hour — it asks the server to sync on its own, and Refresh asks
 * for everything. The server decides which repositories it actually reads, so
 * nothing here can spend the rate limit by itself.
 *
 * The action re-renders the page from the database in the same response, so
 * the numbers stay on screen throughout and change once, when the sync lands.
 */
export function SyncProvider({
  action,
  repositoryIds,
  dueIds,
  children,
}: {
  action: SyncAction;
  repositoryIds: readonly string[];
  dueIds: readonly string[];
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<ReadonlySet<string>>(new Set());
  // Ids already asked for while this page has been open. A row the server
  // still calls due after that (GitHub failed) waits for the next visit or
  // for Refresh, instead of looping.
  const asked = useRef(new Set<string>());

  const run = useCallback(
    (trigger: SyncTrigger, ids: readonly string[]) => {
      for (const id of ids) asked.current.add(id);
      setTarget(new Set(ids));
      startTransition(async () => {
        await action(trigger);
      });
    },
    [action],
  );

  const dueKey = dueIds.join(",");
  useEffect(() => {
    if (pending) return;
    const due = dueKey
      .split(",")
      .filter((id) => id !== "" && !asked.current.has(id));
    if (due.length > 0) run("automatic", due);
  }, [dueKey, pending, run]);

  const value = useMemo<SyncContextValue>(
    () => ({
      syncing: pending,
      isSyncing: (id) => pending && target.has(id),
      refresh: () => run("manual", repositoryIds),
    }),
    [pending, target, run, repositoryIds],
  );

  return <SyncContext value={value}>{children}</SyncContext>;
}
