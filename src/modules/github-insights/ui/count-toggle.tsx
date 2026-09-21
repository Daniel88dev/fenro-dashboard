import { ToggleButton } from "./toggle-button";

export type CountToggleProps = {
  readonly label: string;
  readonly count: number;
  readonly hint: string;
  readonly href: string;
  readonly expanded: boolean;
  readonly panelId: string;
  /** The column's meaning, carried as its colour — teal PRs, rust issues. */
  readonly countClass: string;
};

/** A count is the affordance; the hint beneath it is the reason to click. */
export function CountToggle({
  label,
  count,
  hint,
  href,
  expanded,
  panelId,
  countClass,
}: CountToggleProps) {
  return (
    <ToggleButton
      label={label}
      href={href}
      expanded={expanded}
      controls={panelId}
      className="hover:bg-surface-sunken flex w-full flex-col items-start gap-0.5 px-1.5 py-1 text-left"
    >
      <span
        className={`font-mono text-lg leading-tight font-medium ${count === 0 ? "text-ink-faint" : countClass}`}
      >
        {count}
      </span>
      <span className="text-ink-muted text-[11.5px]">{hint}</span>
    </ToggleButton>
  );
}
