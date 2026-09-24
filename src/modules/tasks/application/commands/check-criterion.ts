import type { TaskError, TaskRepository } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import {
  changeTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

export type CheckCriterionCommand = TaskCommand<"tasks.check-criterion"> & {
  readonly task: TaskReference;
  readonly criterion: number;
  readonly met: boolean;
  readonly evidence?: string | null;
};

export class CheckCriterionHandler implements CommandHandler<CheckCriterionCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: CheckCriterionCommand): Promise<Result<void, TaskError>> {
    return changeTask(this.tasks, command.ownerId, command.task, (task) =>
      task.checkCriterion(
        command.criterion,
        command.met,
        command.evidence ?? null,
        command.actor,
        this.clock(),
      ),
    );
  }
}
