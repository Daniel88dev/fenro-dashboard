import {
  type LabelColour,
  type LabelRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { catalogued } from "./rename-label";
import type { TaskCommand } from "./task-commands";

/** Show a label in another of the nine colours. */
export type RecolourLabelCommand = TaskCommand<"tasks.recolour-label"> & {
  /** The label's name. */
  readonly label: string;
  readonly colour: LabelColour;
};

export class RecolourLabelHandler implements CommandHandler<RecolourLabelCommand> {
  constructor(
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: RecolourLabelCommand,
  ): Promise<Result<void, TaskError>> {
    const now = this.clock();
    const label = await catalogued(
      this.labels,
      command.ownerId,
      command.label,
      now,
    );
    if (!label.ok) return label;
    label.value.recolour(command.colour, now);
    return this.labels.update(label.value);
  }
}
