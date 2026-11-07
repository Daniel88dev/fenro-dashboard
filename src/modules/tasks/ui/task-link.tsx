"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

import { useTaskDialogs, type TaskPreview } from "./task-dialogs";

const TASK_HREF = /^\/tasks\/([^/?#]+)$/;

export function TaskLink({
  href,
  preview,
  onClick,
  onFocus,
  onBlur,
  onPointerEnter,
  onPointerLeave,
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  href: string;
  preview?: Omit<TaskPreview, "key">;
}) {
  const dialogs = useTaskDialogs();
  const pathname = usePathname();
  const key = TASK_HREF.exec(href.split("?")[0]!)?.[1];
  if (key === "new" && isTaskPage(pathname)) {
    return <a href={href} onClick={onClick} {...props} />;
  }
  if (!dialogs || !key || key === "new" || href.includes("?")) {
    return <Link href={href} onClick={onClick} {...props} />;
  }
  const target = decodeURIComponent(key);
  return (
    <a
      href={href}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        dialogs.prefetch(target);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        dialogs.cancelPrefetch(target);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        dialogs.prefetch(target);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        dialogs.cancelPrefetch(target);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || opensElsewhere(event)) return;
        event.preventDefault();
        dialogs.open(target, preview && { key: target, ...preview });
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

const TASK_PAGE = /^\/tasks\/[^/]+$/;

export function isTaskPage(pathname: string): boolean {
  return TASK_PAGE.test(pathname) && pathname !== "/tasks/new";
}
