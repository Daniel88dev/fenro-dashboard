import type {
  FinishOutcome,
  TaskError,
  TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import {
  changeTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

export type FinishSessionCommand = TaskCommand<"tasks.finish-session"> & {
  readonly task: TaskReference;
  readonly outcome: FinishOutcome;
  readonly summary: string;
  readonly reason?: string;
};

export class FinishSessionHandler implements CommandHandler<FinishSessionCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: FinishSessionCommand): Promise<Result<void, TaskError>> {
    return changeTask(
      this.tasks,
      command.ownerId,
      command.task,
      async (task, graph) =>
        task.finishSession(
          command.actor,
          {
            outcome: command.outcome,
            summary: command.summary,
            reason: command.reason,
          },
          (await graph()).surroundingsOf(task.id.value),
          this.clock(),
        ),
    );
  }
}
