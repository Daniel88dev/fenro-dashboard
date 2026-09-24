import type {
  StatusTarget,
  TaskError,
  TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

import {
  changeTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/**
 * Move a task between statuses outside a session, or put it on hold and take
 * it off again. `hold` is the reason it is waiting; `null` releases it.
 */
export type ChangeStatusCommand = TaskCommand<"tasks.change-status"> & {
  readonly task: TaskReference;
  readonly status?: StatusTarget;
  readonly hold?: string | null;
};

export class ChangeStatusHandler implements CommandHandler<ChangeStatusCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: ChangeStatusCommand): Promise<Result<void, TaskError>> {
    const { actor } = command;
    return changeTask(
      this.tasks,
      command.ownerId,
      command.task,
      async (task, graph) => {
        const now = this.clock();
        if (command.hold !== undefined) {
          const held =
            command.hold === null
              ? task.releaseHold(actor, now)
              : task.putOnHold(command.hold, actor, now);
          if (!held.ok) return held;
        }
        if (command.status !== undefined) {
          return task.changeStatus(
            command.status,
            actor,
            (await graph()).surroundingsOf(task.id.value),
            now,
          );
        }
        return ok(undefined);
      },
    );
  }
}
