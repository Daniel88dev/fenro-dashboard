import { priorityRank, type TaskKind } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskOwners, TaskReadStore } from "../ports/task-read-store";
import { MAX_LIMIT, taskKey } from "./projections";

export type ParentOptionItem = {
  readonly key: string;
  readonly title: string;
  readonly kind: TaskKind;
};

export type ParentOptionsQuery = Query<
  "tasks.parent-options",
  ParentOptionItem[]
> & { readonly ownerId: TaskOwners };

export function parentOptionsQuery(ownerId: TaskOwners): ParentOptionsQuery {
  return { type: "tasks.parent-options", ownerId };
}

export class ParentOptionsHandler implements QueryHandler<
  ParentOptionsQuery,
  ParentOptionItem[]
> {
  constructor(private readonly tasks: TaskReadStore) {}

  async handle(query: ParentOptionsQuery): Promise<ParentOptionItem[]> {
    const open = await this.tasks.openTaskTitles(query.ownerId);
    return open
      .sort(
        (a, b) =>
          Number(b.kind === "epic") - Number(a.kind === "epic") ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          a.number - b.number,
      )
      .slice(0, MAX_LIMIT)
      .map((task) => ({
        key: taskKey(task),
        title: task.title,
        kind: task.kind,
      }));
  }
}
