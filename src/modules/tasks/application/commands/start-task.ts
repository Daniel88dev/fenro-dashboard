import type { TaskError, TaskRepository } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

import {
  changeTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/** Claim a task by opening a session on it; resumes the actor's own session. */
export type StartTaskCommand = TaskCommand<"tasks.start-task"> & {
  readonly task: TaskReference;
};

export class StartTaskHandler implements CommandHandler<StartTaskCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: StartTaskCommand): Promise<Result<void, TaskError>> {
    return changeTask(
      this.tasks,
      command.ownerId,
      command.task,
      async (task, graph) => {
        const started = task.startSession(
          command.actor,
          (await graph()).surroundingsOf(task.id.value),
          this.clock(),
        );
        return started.ok ? ok(undefined) : started;
      },
    );
  }
}
