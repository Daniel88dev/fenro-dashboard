import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import { taskError, type TaskError } from "./errors";
import { LabelCreated } from "./events";

/**
 * The colours a label can take: a fixed set of tokens, not free hex, so every
 * one is checked for contrast in both schemes (src/app/palette.test.ts).
 */
export const LABEL_COLOURS = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
] as const;

export type LabelColour = (typeof LABEL_COLOURS)[number];

export function isLabelColour(value: unknown): value is LabelColour {
  return LABEL_COLOURS.includes(value as LabelColour);
}

const LABEL_NAME = /^[a-z0-9][a-z0-9._:/-]{0,39}$/;

/**
 * A label's name is its identity within one person's labels: tasks carry
 * names, and filters and agents name labels the same way. It is stored
 * lower-case, and spaces become hyphens, so "Needs review" and
 * "needs-review" are one label.
 */
export function parseLabelName(raw: string): Result<string, TaskError> {
  const name = normaliseLabelName(raw);
  if (!LABEL_NAME.test(name)) {
    return err(
      taskError(
        "invalid-label",
        `"${raw.trim()}" is not a label name: up to 40 lower-case letters, digits and . _ : / - (spaces become -).`,
      ),
    );
  }
  return ok(name);
}

/** The name as it is kept, whether or not it is a valid one. */
export function normaliseLabelName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * The colour a label gets when nobody picks one: the same for the same name
 * every time, so labels made on the fly by agents still look stable.
 */
export function defaultLabelColour(name: string): LabelColour {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return LABEL_COLOURS[hash % LABEL_COLOURS.length]!;
}

/**
 * The colour for a label made without one: of the colours the owner's other
 * labels use least, the one the name picks. Labels made one after another
 * then look different from each other, rather than as the hash happens to
 * fall.
 */
export function pickLabelColour(
  name: string,
  taken: readonly LabelColour[],
): LabelColour {
  const uses = (colour: LabelColour) =>
    taken.filter((other) => other === colour).length;
  const fewest = Math.min(...LABEL_COLOURS.map(uses));
  const free = LABEL_COLOURS.filter((colour) => uses(colour) === fewest);
  const preferred = defaultLabelColour(name);
  return free.includes(preferred)
    ? preferred
    : free[LABEL_COLOURS.indexOf(preferred) % free.length]!;
}

type Props = {
  readonly ownerId: string;
  readonly name: string;
  readonly colour: LabelColour;
  readonly createdAt: Date;
};

export type NewLabel = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly colour?: LabelColour;
  readonly now: Date;
};

/**
 * One entry in a person's label catalogue: a name tasks can carry and the
 * colour it is shown in. Tasks refer to labels by name, so the catalogue is
 * what the pickers and filters offer, and what keeps a label's colour.
 *
 * That the name is unique per person is kept by the store, which refuses a
 * second label with a name already taken.
 */
export class Label extends AggregateRoot<Props> {
  private constructor(id: UniqueId, props: Props) {
    super(id, props);
  }

  static create(input: NewLabel): Result<Label, TaskError> {
    const name = parseLabelName(input.name);
    if (!name.ok) return name;
    const label = new Label(UniqueId.create(input.id), {
      ownerId: input.ownerId,
      name: name.value,
      colour: input.colour ?? defaultLabelColour(name.value),
      createdAt: input.now,
    });
    label.record(new LabelCreated(input.id, name.value, input.now));
    return ok(label);
  }

  /** Rebuild a label a store already holds, recording no event. */
  static restore(
    id: UniqueId,
    props: {
      ownerId: string;
      name: string;
      colour: LabelColour;
      createdAt: Date;
    },
  ): Label {
    return new Label(id, props);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get colour(): LabelColour {
    return this.props.colour;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

export function labelExists(name: string): TaskError {
  return taskError(
    "label-exists",
    `There is already a label "${name}". Use it as it is: give its name in labels.`,
  );
}
