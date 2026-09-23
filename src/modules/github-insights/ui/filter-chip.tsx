"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * A chip on a panel that narrows or reorders its list. Like the counts, it is
 * a navigation, because which chips are pressed lives in the URL; the button
 * stays mounted across it, so focus stays on the chip.
 */
export function FilterChip({
  label,
  href,
  pressed,
}: {
  label: string;
  href: string;
  pressed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-pending={isPending ? "" : undefined}
      onClick={() => {
        startTransition(() => {
          router.push(href, { scroll: false });
        });
      }}
      className={`focus-visible:outline-pr cursor-pointer rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 data-[pending]:opacity-60 ${
        pressed
          ? "border-pr bg-pr-wash text-pr-strong"
          : "border-hairline bg-surface text-ink-soft hover:bg-surface-sunken"
      }`}
    >
      {label}
    </button>
  );
}
