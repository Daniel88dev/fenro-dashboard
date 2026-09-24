import { ToggleButton } from "./toggle-button";

export type CountToggleProps = {
  readonly label: string;
  readonly count: number;
  readonly hint: string;
  readonly href: string;
  readonly expanded: boolean;
  readonly panelId: string;
  /** The column's meaning, carried as its colour: teal PRs, rust issues. */
  readonly tone: "pr" | "issue" | "neutral";
};

const TONES = {
  pr: { count: "text-pr", open: "bg-pr-wash" },
  issue: { count: "text-issue", open: "bg-issue-wash" },
  neutral: { count: "text-ink", open: "bg-neutral-wash" },
} as const;

/**
 * A count is the affordance; the hint beneath it is the reason to click. An
 * open count is a flat tint of its own colour: no shadow, no underline.
 */
export function CountToggle({
  label,
  count,
  hint,
  href,
  expanded,
  panelId,
  tone,
}: CountToggleProps) {
  const colours = TONES[tone];
  return (
    <ToggleButton
      label={label}
      href={href}
      expanded={expanded}
      controls={panelId}
      className={`-ml-2.5 flex w-[calc(100%+10px)] flex-col items-start gap-px rounded-lg px-2.5 py-2 text-left focus-visible:outline-offset-2 ${
        expanded ? colours.open : "hover:bg-surface-sunken"
      }`}
    >
      <span
        className={`font-mono text-[19px] leading-tight ${count === 0 ? "text-ink-faint" : colours.count}`}
      >
        {count}
      </span>
      <span
        className={`text-[11.5px] ${expanded ? "text-ink-soft" : "text-ink-muted"}`}
      >
        {hint}
      </span>
    </ToggleButton>
  );
}
