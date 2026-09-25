import {
  Label,
  pickLabelColour,
  type LabelColour,
  type LabelRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

import type { TaskCommand } from "./task-commands";

/**
 * Add a label to the owner's catalogue. A task given a name the catalogue
 * lacks adds it too, so this is for labels made ahead of use, or in a colour
 * of the maker's choosing.
 */
export type CreateLabelCommand = TaskCommand<"tasks.create-label"> & {
  readonly labelId: string;
  readonly name: string;
  /** Left out, the name decides it. */
  readonly colour?: LabelColour;
};

export class CreateLabelHandler implements CommandHandler<CreateLabelCommand> {
  constructor(
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: CreateLabelCommand): Promise<Result<void, TaskError>> {
    const label = Label.create({
      id: command.labelId,
      ownerId: command.ownerId,
      name: command.name,
      colour: command.colour,
      now: this.clock(),
    });
    if (!label.ok) return label;
    return this.labels.save(label.value);
  }
}

/**
 * Make sure every name a task is about to carry is in the owner's catalogue,
 * adding the missing ones in the colours the others use least. It runs before
 * the task is saved: the label and the task are separate aggregates, so the
 * worst a failed task save leaves behind is a label nothing carries yet.
 */
export async function ensureLabels(
  labels: LabelRepository,
  ownerId: string,
  names: readonly string[],
  now: Date,
): Promise<Result<void, TaskError>> {
  if (names.length === 0) return ok(undefined);
  const catalogue = await labels.all(ownerId);
  const known = new Set(catalogue.map((label) => label.name));
  const colours = catalogue.map((label) => label.colour);
  for (const name of names) {
    if (known.has(name)) continue;
    const label = Label.create({
      id: crypto.randomUUID(),
      ownerId,
      name,
      colour: pickLabelColour(name, colours),
      now,
    });
    if (!label.ok) return label;
    colours.push(label.value.colour);
    const saved = await labels.save(label.value);
    // Another request added it in between: it is there, which is the point.
    if (!saved.ok && saved.error.code !== "label-exists") return saved;
  }
  return ok(undefined);
}
