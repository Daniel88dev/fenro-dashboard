"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useTrackedTransition } from "@/modules/github-insights/ui/navigation-progress";

import { RouteDialog } from "./route-dialog";
import { OPEN_PARAM, taskHref } from "./task-state";

const TaskPage = createContext<string | null>(null);

// From a task page, any router navigation to a task URL is caught by the
// dialog interception route and reloads the page. So the page opens tasks in a
// dialog of its own: links change the address in place and refresh the page.
export function OnTaskPage({
  taskKey,
  children,
}: {
  taskKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  useEffect(() => {
    const page = taskHref(taskKey);
    const restored = () => {
      if (window.location.pathname === page) router.refresh();
    };
    window.addEventListener("popstate", restored);
    return () => window.removeEventListener("popstate", restored);
  }, [router, taskKey]);
  return <TaskPage value={taskKey}>{children}</TaskPage>;
}

const TASK_HREF = /^\/tasks\/([^/?#]+)$/;

export function TaskLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  const page = useContext(TaskPage);
  const router = useRouter();
  const [, startTransition] = useTrackedTransition();
  if (page === null) return <Link href={href} onClick={onClick} {...props} />;
  const key = TASK_HREF.exec(href)?.[1];
  if (!key || key === "new") {
    return <a href={href} onClick={onClick} {...props} />;
  }
  const target = decodeURIComponent(key);
  const inPage =
    target === page
      ? taskHref(page)
      : `${taskHref(page)}?${OPEN_PARAM}=${encodeURIComponent(target)}`;
  return (
    <a
      href={inPage}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || opensElsewhere(event)) return;
        event.preventDefault();
        window.history.pushState(null, "", inPage);
        startTransition(() => router.refresh());
      }}
      {...props}
    />
  );
}

function opensElsewhere(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function TaskPageDialog({
  taskKey,
  children,
}: {
  taskKey: string;
  children: ReactNode;
}) {
  const open = useSearchParams().get(OPEN_PARAM);
  if (open !== taskKey) return null;
  return (
    <RouteDialog
      labelledBy="task-dialog-title"
      width="sm:w-[920px]"
      onClose={() => window.history.back()}
    >
      {children}
    </RouteDialog>
  );
}

const TASK_PAGE = /^\/tasks\/[^/]+$/;

export function isTaskPage(pathname: string): boolean {
  return TASK_PAGE.test(pathname) && pathname !== "/tasks/new";
}
