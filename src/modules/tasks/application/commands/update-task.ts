import {
  normaliseLabelName,
  RepositoryReference,
  taskError,
  type LabelRepository,
  type Priority,
  type TaskEdit,
  type TaskError,
  type TaskKind,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { NO_MEMBERS, type SpaceMembers } from "../ports/space-members";
import { ensureLabels } from "./create-label";
import { parseReferences, type ReferenceInput } from "./create-task";
import {
  changeTask,
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

export type UpdateTaskCommand = TaskCommand<"tasks.update-task"> & {
  readonly task: TaskReference;
  readonly kind?: TaskKind;
  readonly title?: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly labels?: readonly string[];
  readonly addLabels?: readonly string[];
  readonly removeLabels?: readonly string[];
  readonly repository?: string | null;
  /** A member's GitHub login, or null to unassign; only on a group task. */
  readonly assignee?: string | null;
  readonly parent?: TaskReference | null;
  readonly addCriteria?: readonly string[];
  readonly removeCriteria?: readonly number[];
  readonly attach?: readonly ReferenceInput[];
  readonly detach?: readonly string[];
};

export class UpdateTaskHandler implements CommandHandler<UpdateTaskCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
    private readonly members: SpaceMembers = NO_MEMBERS,
  ) {}

  async handle(command: UpdateTaskCommand): Promise<Result<void, TaskError>> {
    const { ownerId, actor } = command;

    const edit: { -readonly [K in keyof TaskEdit]: TaskEdit[K] } = {
      title: command.title,
      description: command.description,
      priority: command.priority,
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

        const labels = labelsAfter(task.state.labels, command);
        const edited = task.edit({ ...edit, labels }, actor, now);
        if (!edited.ok) return edited;
        if (labels !== undefined) {
          const labelled = await ensureLabels(
            this.labels,
            ownerId,
            task.state.labels,
            now,
          );
          if (!labelled.ok) return labelled;
        }

        if (command.assignee !== undefined) {
          const members = command.assignee
            ? await this.members.of(ownerId, task.keyPrefix)
            : [];
          const assigned = task.assign(command.assignee, members, actor, now);
          if (!assigned.ok) return assigned;
        }

        // An epic that becomes a task may then go under a parent; a task that
        // becomes an epic must leave its parent first.
        if (command.kind === "task") {
          const changed = task.changeKind("task", actor, now);
          if (!changed.ok) return changed;
        }

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

        if (command.kind === "epic") {
          const changed = task.changeKind("epic", actor, now);
          if (!changed.ok) return changed;
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

function labelsAfter(
  current: readonly string[],
  command: UpdateTaskCommand,
): readonly string[] | undefined {
  const { labels, addLabels, removeLabels } = command;
  if (labels === undefined && !addLabels?.length && !removeLabels?.length) {
    return undefined;
  }
  const removed = new Set((removeLabels ?? []).map(normaliseLabelName));
  return [...(labels ?? current), ...(addLabels ?? [])].filter(
    (name) => !removed.has(normaliseLabelName(name)),
  );
}
