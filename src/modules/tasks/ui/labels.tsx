import { defaultLabelColour, type LabelColour } from "@/modules/tasks/domain";

/** The label palette as Tailwind classes, written out so Tailwind finds them. */
const DOTS: Record<LabelColour, string> = {
  gray: "bg-label-gray",
  red: "bg-label-red",
  orange: "bg-label-orange",
  yellow: "bg-label-yellow",
  green: "bg-label-green",
  teal: "bg-label-teal",
  blue: "bg-label-blue",
  purple: "bg-label-purple",
  pink: "bg-label-pink",
};

export function labelFill(colour: LabelColour): string {
  return DOTS[colour];
}

export type LabelOption = {
  readonly name: string;
  readonly colour: LabelColour;
};

export function colourOf(
  catalogue: readonly LabelOption[],
  name: string,
): LabelColour {
  return (
    catalogue.find((label) => label.name === name)?.colour ??
    defaultLabelColour(name)
  );
}

export function LabelDot({ colour }: { colour: LabelColour }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-full ${DOTS[colour]}`}
    />
  );
}

/**
 * The colour goes only in the dot: the accents keep their one meaning (teal for
 * pull requests and healthy, rust for issues and stale).
 */
export function LabelChip({
  name,
  colour,
}: {
  name: string;
  colour: LabelColour;
}) {
  return (
    <span className="bg-neutral-wash text-ink-soft inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      <LabelDot colour={colour} />
      {name}
    </span>
  );
}

export function LabelChips({
  names,
  catalogue,
}: {
  names: readonly string[];
  catalogue: readonly LabelOption[];
}) {
  return names.map((name) => (
    <LabelChip key={name} name={name} colour={colourOf(catalogue, name)} />
  ));
}
