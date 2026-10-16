import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import { taskError, type TaskError } from "./errors";
import { LabelCreated, LabelRecoloured, LabelRenamed } from "./events";

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

export function normaliseLabelName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * The same for the same name every time, so labels made on the fly by
 * agents still look stable.
 */
export function defaultLabelColour(name: string): LabelColour {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return LABEL_COLOURS[hash % LABEL_COLOURS.length]!;
}

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
  name: string;
  colour: LabelColour;
  readonly createdAt: Date;
};

export type NewLabel = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly colour?: LabelColour;
  readonly now: Date;
};

/** That the name is unique per person is kept by the store, not here. */
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

  recolour(colour: LabelColour, now: Date): void {
    if (colour === this.props.colour) return;
    this.props.colour = colour;
    this.record(new LabelRecoloured(this.id.value, colour, now));
  }

  rename(raw: string, now: Date): Result<void, TaskError> {
    const name = parseLabelName(raw);
    if (!name.ok) return name;
    if (name.value === this.props.name) return ok(undefined);
    const from = this.props.name;
    this.props.name = name.value;
    this.record(new LabelRenamed(this.id.value, from, name.value, now));
    return ok(undefined);
  }
}

export function labelNotFound(name: string): TaskError {
  return taskError(
    "label-not-found",
    `There is no label "${name}". List labels to see their names.`,
  );
}

export function labelExists(name: string): TaskError {
  return taskError(
    "label-exists",
    `There is already a label "${name}". Use it as it is: give its name in labels.`,
  );
}
