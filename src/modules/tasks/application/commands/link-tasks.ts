import {
  taskError,
  type LinkKind,
  type TaskError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import {
  changeTask,
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/** "`task` is blocked by / relates to / was discovered from `target`". */
export type LinkTasksCommand = TaskCommand<"tasks.link-tasks"> & {
  readonly task: TaskReference;
  readonly kind: LinkKind;
  readonly target: TaskReference;
  /** Remove the link instead of adding it. */
  readonly remove?: boolean;
};

export class LinkTasksHandler implements CommandHandler<LinkTasksCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: LinkTasksCommand): Promise<Result<void, TaskError>> {
    const target = await findTask(this.tasks, command.ownerId, command.target);
    if (!target.ok) return target;
    const targetId = target.value.id.value;
    const targetKey = target.value.key;

    return changeTask(
      this.tasks,
      command.ownerId,
      command.task,
      async (task, graph) => {
        const now = this.clock();
        if (command.remove) {
          task.unlink(command.kind, targetId, command.actor, now);
          return ok(undefined);
        }
        if (
          command.kind === "blocked-by" &&
          (await graph()).wouldCycleByBlocking(task.id.value, targetId)
        ) {
          return err(
            taskError(
              "dependency-cycle",
              `${task.key} cannot be blocked by ${targetKey}: ${targetKey} already waits on ${task.key}, directly, through other tasks, or as its parent. The two would never become ready.`,
            ),
          );
        }
        return task.link(command.kind, targetId, command.actor, now);
      },
    );
  }
}
