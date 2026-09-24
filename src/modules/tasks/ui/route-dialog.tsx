"use client";

import { X } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A dialog that is a route: the address is the task's own, so a reload or a
 * shared link opens the full page instead. Closing goes back in history,
 * which is what unmounts it. The native dialog brings the focus trap, Escape
 * and the inert page behind it.
 */
export function RouteDialog({
  labelledBy,
  width,
  children,
}: {
  labelledBy: string;
  /** Tailwind width for the dialog on wide screens, e.g. `sm:w-[920px]`. */
  width: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        router.back();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) router.back();
      }}
      className={`border-hairline bg-surface text-ink mx-auto mt-4 mb-4 max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] max-w-none overflow-hidden rounded-xl border p-0 shadow-[0_24px_64px_-16px_rgba(20,18,10,0.35)] backdrop:bg-[rgba(22,22,18,0.42)] sm:mt-14 sm:max-h-[calc(100dvh-88px)] ${width}`}
    >
      <div className="flex max-h-[inherit] flex-col">{children}</div>
    </dialog>
  );
}

export function CloseDialogButton({ label = "Close" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => router.back()}
      className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr grid size-[30px] cursor-pointer place-items-center rounded-lg focus-visible:outline-2"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}

/** Cancel in a dialog's footer: the same as closing it. */
export function CancelDialogButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr h-[34px] cursor-pointer rounded-lg px-[13px] text-[12.5px] font-medium focus-visible:outline-2"
    >
      Cancel
    </button>
  );
}
