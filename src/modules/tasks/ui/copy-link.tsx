"use client";

import { Check, LinkSimple } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";

import { taskHref } from "./task-state";

/** How long "Copied" stays before the button goes back to its icon. */
const COPIED_FOR_MS = 1600;

/**
 * Copies a task's full address, as Jira does beside an issue key: the quick
 * way to hand a task to an agent, which takes the link as readily as the key.
 * The address is the one the person is on, so a preview copies a preview link.
 */
export function CopyTaskLink({ taskKey }: { taskKey: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const url = new URL(taskHref(taskKey), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard access (an insecure origin, a denied permission),
      // let the person copy it by hand.
      window.prompt("Copy this link", url);
    }
  };

  const tip = copied ? "Copied" : "Copy link";
  return (
    <span className="group/copy relative inline-flex">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy link to ${taskKey}`}
        className="text-ink-muted hover:text-ink hover:bg-surface-sunken focus-visible:outline-pr grid size-6 cursor-pointer place-items-center rounded-md focus-visible:outline-2"
      >
        {copied ? (
          <Check aria-hidden="true" weight="bold" className="size-3.5" />
        ) : (
          <LinkSimple aria-hidden="true" className="size-3.5" />
        )}
      </button>
      <span
        role="status"
        className={`bg-ink text-ground pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap ${copied ? "block" : "hidden group-focus-within/copy:block group-hover/copy:block"}`}
      >
        {tip}
      </span>
    </span>
  );
}
