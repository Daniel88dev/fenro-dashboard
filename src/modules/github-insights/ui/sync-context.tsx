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
  readonly syncing: boolean;
  readonly isSyncing: (repositoryId: string) => boolean;
  readonly updating: number;
  readonly refresh: () => void;
};

const SyncContext = createContext<SyncContextValue>({
  syncing: false,
  isSyncing: () => false,
  updating: 0,
  refresh: () => {},
});

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

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
      updating: pending ? target.size : 0,
      refresh: () => run("manual", repositoryIds),
    }),
    [pending, target, run, repositoryIds],
  );

  return <SyncContext value={value}>{children}</SyncContext>;
}
