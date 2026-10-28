import type { TaskError, TaskRepository } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

import { changeTask, type TaskCommand } from "./task-commands";

/** Someone who left a group keeps none of its tasks. */
export type ReleaseAssigneeCommand = TaskCommand<"tasks.release-assignee"> & {
  readonly userId: string;
};

export class ReleaseAssigneeHandler implements CommandHandler<ReleaseAssigneeCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: ReleaseAssigneeCommand,
  ): Promise<Result<void, TaskError>> {
    const assigned = await this.tasks.assignedTo(
      command.ownerId,
      command.userId,
    );
    for (const task of assigned) {
      const released = await changeTask(
        this.tasks,
        command.ownerId,
        task.id.value,
        (current) =>
          current.assigneeId === command.userId
            ? current.assign(null, [], command.actor, this.clock())
            : ok(undefined),
      );
      if (!released.ok) return released;
    }
    return ok(undefined);
  }
}
