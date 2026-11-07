"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { Spinner } from "./spinner";

type Progress = {
  readonly navigating: boolean;
  readonly busy: boolean;
  readonly url: string;
  readonly begin: () => () => void;
};

const ProgressContext = createContext<Progress | null>(null);

// A link that never reaches a new URL (an aborted or prevented navigation)
// must not leave the line running.
const GIVE_UP_MS = 10_000;

export function NavigationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [navigating, setNavigating] = useState(false);
  const [waits, setWaits] = useState(0);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (leavesForNewUrl(event)) setNavigating(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!navigating) return;
    const timer = setTimeout(() => setNavigating(false), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [navigating]);

  const arrived = useCallback((next: string) => {
    setUrl(next);
    setNavigating(false);
  }, []);

  const begin = useCallback(() => {
    setWaits((count) => count + 1);
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      setWaits((count) => count - 1);
    };
  }, []);

  const value = useMemo(
    () => ({ navigating, busy: navigating || waits > 0, url, begin }),
    [navigating, waits, url, begin],
  );

  return (
    <ProgressContext value={value}>
      <Suspense fallback={null}>
        <UrlWatcher onArrive={arrived} />
      </Suspense>
      {children}
    </ProgressContext>
  );
}

function UrlWatcher({ onArrive }: { onArrive: (url: string) => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    onArrive(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search, onArrive]);
  return null;
}

function leavesForNewUrl(event: MouseEvent): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const anchor =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.dataset.progress === "off") return false;
  const to = new URL(anchor.href, window.location.href);
  if (to.origin !== window.location.origin) return false;
  return (
    to.pathname !== window.location.pathname ||
    to.search !== window.location.search
  );
}

/** Keeps the top bar line running while `pending` is true. */
export function useReportPending(pending: boolean) {
  const begin = useContext(ProgressContext)?.begin;
  useEffect(() => {
    if (!pending || !begin) return;
    return begin();
  }, [pending, begin]);
}

/** A transition whose wait also shows on the top bar line. */
export function useTrackedTransition() {
  const [pending, startTransition] = useTransition();
  useReportPending(pending);
  return [pending, startTransition] as const;
}

/** `router.push` whose wait also shows on the top bar line. */
export function usePendingPush(options?: { scroll?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTrackedTransition();
  const scroll = options?.scroll;
  const push = useCallback(
    (href: string) =>
      startTransition(() =>
        scroll === undefined
          ? router.push(href)
          : router.push(href, { scroll }),
      ),
    [router, startTransition, scroll],
  );
  return [pending, push] as const;
}

/**
 * For a control whose links leave through a menu that closes on the click:
 * true from the pick until the new URL arrives.
 */
export function usePickPending() {
  const progress = useContext(ProgressContext);
  const [pickedOn, setPickedOn] = useState<string | null>(null);
  const url = progress?.url ?? "";
  const pending = progress !== null && progress.navigating && pickedOn === url;
  const pick = useCallback(() => setPickedOn(url), [url]);
  return [pending, pick] as const;
}

export function NavigationProgressBar() {
  const busy = useContext(ProgressContext)?.busy ?? false;
  if (!busy) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading"
      data-testid="navigation-progress"
      className="bg-bar-active animate-appear pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden sm:absolute sm:top-auto sm:bottom-0"
    >
      <div className="bg-bar-progress motion-safe:animate-sync-bar h-full w-2/5" />
    </div>
  );
}

/** Appears only after a short wait, so quick saves never flicker. */
export function PendingSpinner({
  className = "size-3.5",
  colour,
}: {
  className?: string;
  colour?: string;
}) {
  return (
    <span aria-hidden="true" className="animate-appear inline-flex shrink-0">
      <Spinner className={className} colour={colour} />
    </span>
  );
}
