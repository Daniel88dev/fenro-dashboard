"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

export type ToggleButtonProps = {
  readonly label: string;
  readonly href: string;
  readonly expanded: boolean;
  readonly controls: string;
  readonly className?: string;
  readonly children: ReactNode;
};

// A navigation, since expansion lives in the URL; the button stays mounted
// across it, which keeps focus where the reader left it.
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
      className={`focus-visible:outline-pr cursor-pointer transition-colors focus-visible:outline-2 data-[pending]:opacity-60 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
