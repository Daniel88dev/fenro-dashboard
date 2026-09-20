import type { ReactNode } from "react";

export type Tone = "healthy" | "attention" | "neutral";

const TONES: Record<Tone, string> = {
  healthy: "bg-pr-wash text-pr-strong",
  attention: "bg-issue-wash text-issue-strong",
  neutral: "bg-neutral-wash text-ink-soft",
};

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
