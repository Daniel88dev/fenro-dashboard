"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A small drop-down built on a native disclosure, so it opens from the
 * keyboard with no script at all. The script only adds what a disclosure
 * lacks as a menu: closing on Escape and on a click anywhere else.
 */
export function Menu({
  label,
  trigger,
  triggerClassName,
  panelClassName,
  opensUp = false,
  children,
}: {
  /** The accessible name of the button that opens it. */
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  panelClassName?: string;
  /** Open above the trigger, for a menu at the bottom of a dialog. */
  opensUp?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return;
      close();
      details.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        aria-label={label}
        className={`cursor-pointer list-none focus-visible:outline-2 [&::-webkit-details-marker]:hidden ${triggerClassName}`}
      >
        {trigger}
      </summary>
      <div
        className={`border-hairline bg-surface text-ink absolute right-0 z-20 flex w-56 ${opensUp ? "bottom-full mb-1.5" : "mt-1.5"} flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)] ${panelClassName ?? ""}`}
      >
        {children}
      </div>
    </details>
  );
}
