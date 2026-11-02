"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";

const TaskPage = createContext(false);

// A task dialog over a task page cannot survive a router refresh: the refresh
// of the page behind is intercepted into a dialog and the router reloads. So
// tasks reached from a task page open as full pages instead.
export function OnTaskPage({ children }: { children: ReactNode }) {
  return <TaskPage value={true}>{children}</TaskPage>;
}

export function TaskLink({
  href,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  if (useContext(TaskPage)) return <a href={href} {...props} />;
  return <Link href={href} {...props} />;
}

const TASK_PAGE = /^\/tasks\/[^/]+$/;

export function isTaskPage(pathname: string): boolean {
  return TASK_PAGE.test(pathname) && pathname !== "/tasks/new";
}
