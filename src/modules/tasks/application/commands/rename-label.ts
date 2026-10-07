import {
  labelNotFound,
  parseLabelName,
  type Label,
  type LabelRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { ensureLabels } from "./create-label";
import type { TaskCommand } from "./task-commands";

/**
 * Give a label a new name. Every task and skill carrying the old name carries
 * the new one afterwards, in one transaction, so no link drops. Refused with
 * `label-exists` when the new name is another label's.
 */
export type RenameLabelCommand = TaskCommand<"tasks.rename-label"> & {
  /** The label's current name. */
  readonly label: string;
  readonly name: string;
};

export class RenameLabelHandler implements CommandHandler<RenameLabelCommand> {
  constructor(
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: RenameLabelCommand): Promise<Result<void, TaskError>> {
    const now = this.clock();
    const label = await catalogued(
      this.labels,
      command.ownerId,
      command.label,
      now,
    );
    if (!label.ok) return label;
    const renamed = label.value.rename(command.name, now);
    if (!renamed.ok) return renamed;
    return this.labels.update(label.value);
  }
}

/**
 * The catalogue entry for a label name. Labels written before the catalogue
 * existed are only on tasks, yet listed like the rest, so a name in use gets
 * its entry here rather than being refused.
 */
export async function catalogued(
  labels: LabelRepository,
  ownerId: string,
  raw: string,
  now: Date,
): Promise<Result<Label, TaskError>> {
  const name = parseLabelName(raw);
  if (!name.ok) return err(labelNotFound(raw.trim()));

  const existing = await labels.findByName(ownerId, name.value);
  if (existing) return ok(existing);
  if (!(await labels.inUse(ownerId, name.value))) {
    return err(labelNotFound(name.value));
  }
  const added = await ensureLabels(labels, ownerId, [name.value], now);
  if (!added.ok) return added;
  const label = await labels.findByName(ownerId, name.value);
  return label ? ok(label) : err(labelNotFound(name.value));
}
