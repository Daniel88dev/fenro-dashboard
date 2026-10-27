"use client";

import { Check, Copy } from "@phosphor-icons/react/ssr";
import { useState } from "react";

const BUTTON =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1";

export function CopyLine({
  label,
  value,
  button,
}: {
  label: string;
  value: string;
  button: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text stays selectable.
    }
  };
  // The value box hugs a short value from `sm` up but may still shrink, so a
  // long one (the connect command) wraps inside the card instead of pushing
  // the button past its edge.
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-ink-soft text-[12px]">{label}</span>
      <div className="flex items-start gap-2">
        <code className="border-hairline bg-surface text-ink min-h-[34px] min-w-0 flex-1 rounded-lg border px-3 py-[7px] font-mono text-[12px] leading-[18px] break-all whitespace-pre-wrap select-all sm:flex-initial">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={button}
          className={BUTTON}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-[15px]" />
          ) : (
            <Copy aria-hidden="true" className="size-[15px]" />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : button}</span>
        </button>
      </div>
    </div>
  );
}
