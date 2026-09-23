import {
  RepositoryReference,
  taskError,
  type Priority,
  type TaskEdit,
  type TaskError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { parseReferences, type ReferenceInput } from "./create-task";
import {
  changeTask,
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/**
 * Everything about a task that is plain editing: what it says, where it sits,
 * what it must meet and what it links to outside. Fields left out stay as they
 * are; `null` clears the repository or the parent.
 */
export type UpdateTaskCommand = TaskCommand<"tasks.update-task"> & {
  readonly task: TaskReference;
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly labels?: readonly string[];
  readonly repository?: string | null;
  readonly parent?: TaskReference | null;
  readonly addCriteria?: readonly string[];
  readonly removeCriteria?: readonly number[];
  readonly attach?: readonly ReferenceInput[];
  /** URLs of references to remove. */
  readonly detach?: readonly string[];
};

export class UpdateTaskHandler implements CommandHandler<UpdateTaskCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: UpdateTaskCommand): Promise<Result<void, TaskError>> {
    const { ownerId, actor } = command;

    const edit: { -readonly [K in keyof TaskEdit]: TaskEdit[K] } = {
      title: command.title,
      description: command.description,
      priority: command.priority,
      labels: command.labels,
    };
    if (command.repository !== undefined) {
      if (command.repository === null) {
        edit.repository = null;
      } else {
        const parsed = RepositoryReference.parse(command.repository);
        if (!parsed.ok) return parsed;
        edit.repository = parsed.value;
      }
    }

    const attach = parseReferences(command.attach ?? []);
    if (!attach.ok) return attach;

    let parentId: string | null | undefined;
    if (command.parent === null) parentId = null;
    if (command.parent) {
      const parent = await findTask(this.tasks, ownerId, command.parent);
      if (!parent.ok) return parent;
      parentId = parent.value.id.value;
    }

    return changeTask(
      this.tasks,
      ownerId,
      command.task,
      async (task, graph) => {
        const now = this.clock();

        const edited = task.edit(edit, actor, now);
        if (!edited.ok) return edited;

        if (parentId !== undefined && parentId !== task.parentId) {
          if (
            parentId &&
            (await graph()).wouldCycleByParent(task.id.value, parentId)
          ) {
            return err(
              taskError(
                "dependency-cycle",
                `${task.key} cannot go under ${command.parent}: that task already waits on ${task.key}, as its sub-task or through a blocking link.`,
              ),
            );
          }
          const moved = task.moveUnder(parentId, actor, now);
          if (!moved.ok) return moved;
        }

        for (const number of command.removeCriteria ?? []) {
          const removed = task.removeCriterion(number, actor, now);
          if (!removed.ok) return removed;
        }
        if (command.addCriteria?.length) {
          const added = task.addCriteria(command.addCriteria, actor, now);
          if (!added.ok) return added;
        }

        for (const url of command.detach ?? []) task.detach(url, actor, now);
        for (const reference of attach.value)
          task.attach(reference, actor, now);

        return ok(undefined);
      },
    );
  }
}
