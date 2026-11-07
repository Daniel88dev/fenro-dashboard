"use client";

import { ArrowsOutSimple } from "@phosphor-icons/react/ssr";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from "react";

import type { TaskBrief } from "@/modules/tasks/application/queries/read-models";
import type { TaskKind } from "@/modules/tasks/domain";

import type { Reader } from "./assignee";
import type { LabelOption } from "./labels";
import { CloseDialogButton, RouteDialog } from "./route-dialog";
import { TaskDialogContent } from "./task-dialog";
import type { TaskAction, TaskActions } from "./task-forms";
import { TaskKindIcon } from "./task-kind";
import { TaskRefresh } from "./task-refresh";
import { OPEN_PARAM, taskHref } from "./task-state";

export type TaskDialogView = {
  readonly task: TaskBrief;
  readonly labels: readonly LabelOption[];
  readonly you: Reader;
  readonly picturesEnabled: boolean;
};

export type TaskPreview = {
  readonly key: string;
  readonly title: string;
  readonly kind?: TaskKind;
};

type Loaded = { readonly view: TaskDialogView } | { readonly error: string };

type Dialogs = {
  open(key: string, preview?: TaskPreview): void;
  prefetch(key: string): void;
};

const DialogsContext = createContext<Dialogs | null>(null);

export function useTaskDialogs(): Dialogs | null {
  return useContext(DialogsContext);
}

const HISTORY_MARK = "fenroTaskDialog";
const DIALOG_CHANGED = "fenro:task-dialog";
// A hover shortly before the click is the same read; an older one may have
// missed an agent's changes, so opening asks again.
const FRESH_FOR_MS = 15_000;

export function TaskDialogs({
  actions,
  children,
}: {
  actions: TaskActions;
  children: ReactNode;
}) {
  const asked = useRef(new Map<string, number>());
  const [previews, setPreviews] = useState<ReadonlyMap<string, TaskPreview>>(
    () => new Map(),
  );
  const [loaded, setLoaded] = useState<ReadonlyMap<string, Loaded>>(
    () => new Map(),
  );

  const load = useCallback((key: string, force = false) => {
    const at = asked.current.get(key);
    if (!force && at !== undefined && Date.now() - at < FRESH_FOR_MS) return;
    const now = Date.now();
    asked.current.set(key, now);
    void readTask(key).then((result) => {
      if (asked.current.get(key) !== now) return;
      if ("error" in result) asked.current.delete(key);
      setLoaded((current) => {
        const shown = current.get(key);
        if ("error" in result && shown && "view" in shown) return current;
        return new Map(current).set(key, result);
      });
    });
  }, []);

  const dialogs = useMemo<Dialogs>(
    () => ({
      open(key, preview) {
        if (window.location.pathname === taskHref(key)) {
          closeDialog();
          return;
        }
        if (preview) {
          setPreviews((current) => new Map(current).set(key, preview));
        }
        load(key);
        const url = new URL(window.location.href);
        url.hash = new URLSearchParams({ [OPEN_PARAM]: key }).toString();
        window.history.pushState({ [HISTORY_MARK]: true }, "", url);
        window.dispatchEvent(new Event(DIALOG_CHANGED));
      },
      prefetch: (key) => load(key),
    }),
    [load],
  );

  return (
    <DialogsContext value={dialogs}>
      {children}
      <Suspense fallback={null}>
        <OpenTaskDialog
          actions={actions}
          loaded={loaded}
          previews={previews}
          load={load}
        />
      </Suspense>
    </DialogsContext>
  );
}

function OpenTaskDialog({
  actions,
  loaded,
  previews,
  load,
}: {
  actions: TaskActions;
  loaded: ReadonlyMap<string, Loaded>;
  previews: ReadonlyMap<string, TaskPreview>;
  load: (key: string, force?: boolean) => void;
}) {
  const key = useOpenedTask();
  useEffect(() => {
    if (key) load(key);
  }, [key, load]);

  const refresh = useCallback(() => {
    if (key) load(key, true);
  }, [key, load]);
  const refreshing = useMemo(
    () => refreshAfter(actions, refresh),
    [actions, refresh],
  );

  if (!key) return null;
  const result = loaded.get(key);
  return (
    <RouteDialog
      labelledBy="task-dialog-title"
      width="sm:w-[920px]"
      onClose={closeDialog}
    >
      <TaskRefresh value={refresh}>
        {result && "view" in result ? (
          <TaskDialogContent
            key={key}
            task={result.view.task}
            actions={refreshing}
            labels={result.view.labels}
            picturesEnabled={result.view.picturesEnabled}
            you={result.view.you}
          />
        ) : (
          <PendingTask
            preview={previews.get(key) ?? { key, title: "" }}
            error={result && "error" in result ? result.error : null}
          />
        )}
      </TaskRefresh>
    </RouteDialog>
  );
}

function PendingTask({
  preview,
  error,
}: {
  preview: TaskPreview;
  error: string | null;
}) {
  return (
    <>
      <div className="border-hairline-soft flex items-start justify-between gap-4 border-b px-5 pt-[18px] pb-3.5 sm:px-[22px]">
        <h2
          id="task-dialog-title"
          className="text-ink text-[19px] leading-snug font-semibold tracking-tight"
        >
          {preview.kind ? (
            <span className="mr-2 inline-block align-[-3px]">
              <TaskKindIcon kind={preview.kind} />
            </span>
          ) : null}
          <span className="text-ink-faint mr-2 font-mono font-medium">
            {preview.key}
          </span>
          {preview.title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={taskHref(preview.key)}
            className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium focus-visible:outline-2"
          >
            <ArrowsOutSimple aria-hidden="true" className="size-3.5" />
            Full page
          </a>
          <CloseDialogButton />
        </div>
      </div>
      <p
        role="status"
        className={`px-5 py-6 text-[13px] sm:px-[22px] ${error ? "text-issue-strong" : "text-ink-muted"}`}
      >
        {error ?? "Loading the task…"}
      </p>
    </>
  );
}

// The key lives in the hash, not the query: a refresh after a change would
// otherwise render the page for a new query and Next would scroll it to the top.
function useOpenedTask(): string | null {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The router's own navigations drop the hash without an event, and write the
  // new address only after they render, so look again once they have.
  useEffect(() => {
    const later = setTimeout(() =>
      window.dispatchEvent(new Event(DIALOG_CHANGED)),
    );
    return () => clearTimeout(later);
  }, [pathname, search]);
  return useSyncExternalStore(subscribeToDialog, openedTask, () => null);
}

function openedTask(): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get(OPEN_PARAM);
}

function subscribeToDialog(changed: () => void): () => void {
  const events = ["popstate", "hashchange", DIALOG_CHANGED];
  for (const name of events) window.addEventListener(name, changed);
  return () => {
    for (const name of events) window.removeEventListener(name, changed);
  };
}

function closeDialog(): void {
  if (window.history.state?.[HISTORY_MARK]) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(DIALOG_CHANGED));
}

function refreshAfter(actions: TaskActions, refresh: () => void): TaskActions {
  const wrap =
    (action: TaskAction): TaskAction =>
    async (state, formData) => {
      const next = await action(state, formData);
      refresh();
      return next;
    };
  return Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [name, wrap(action)]),
  ) as TaskActions;
}

async function readTask(key: string): Promise<Loaded> {
  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(key)}`);
    if (response.ok) return { view: (await response.json()) as TaskDialogView };
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    return { error: body.error ?? "This task could not be loaded." };
  } catch {
    return { error: "This task could not be loaded. Try again." };
  }
}
