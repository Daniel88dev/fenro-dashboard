import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import { listTasks, TaskIndex, type TaskFilter } from "./projections";
import type { TaskList } from "./read-models";

/**
 * The owner's tasks, filtered. `ready: true` is the queue an agent picks its
 * next task from. The parent is named by key and resolved here, so a caller
 * never needs an id.
 */
export type ListTasksQuery = Query<"tasks.list-tasks", TaskList> & {
  readonly ownerId: string;
  readonly filter: Omit<TaskFilter, "parentId"> & { readonly parent?: string };
};

export function listTasksQuery(
  ownerId: string,
  filter: ListTasksQuery["filter"] = {},
): ListTasksQuery {
  return { type: "tasks.list-tasks", ownerId, filter };
}

export class ListTasksHandler implements QueryHandler<
  ListTasksQuery,
  TaskList
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: ListTasksQuery): Promise<TaskList> {
    const index = new TaskIndex(
      await this.tasks.records(query.ownerId),
      this.clock(),
    );
    const { parent, ...filter } = query.filter;
    if (parent === undefined) return listTasks(index, filter);

    const parentRecord = index.records.find(
      (record) =>
        `T-${record.number}`.toLowerCase() === parent.trim().toLowerCase() ||
        record.id === parent.trim(),
    );
    if (!parentRecord) return { total: 0, tasks: [] };
    return listTasks(index, { ...filter, parentId: parentRecord.id });
  }
}
