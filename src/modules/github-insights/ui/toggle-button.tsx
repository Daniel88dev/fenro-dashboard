"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

export type ToggleButtonProps = {
  /** The whole accessible name: a count alone does not say what it counts. */
  readonly label: string;
  readonly href: string;
  readonly expanded: boolean;
  readonly controls: string;
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * Expanding is a navigation, because the expansion state lives in the URL. The
 * button stays mounted across it, which is what keeps focus where the reader
 * left it when a panel opens and again when it closes.
 */
export function ToggleButton({
  label,
  href,
  expanded,
  controls,
  className,
  children,
}: ToggleButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      data-pending={isPending ? "" : undefined}
      onClick={() => {
        startTransition(() => {
          router.push(href, { scroll: false });
        });
      }}
      className={`focus-visible:outline-pr cursor-pointer rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 data-[pending]:opacity-60 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
