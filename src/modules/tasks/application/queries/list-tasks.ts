import { parseTaskKey } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskRecord, TaskReadStore } from "../ports/task-read-store";
import { listTasks, TaskIndex, type TaskFilter } from "./projections";
import type { TaskList } from "./read-models";

/** A filter as a caller writes it: tasks named by key or link, never by id. */
export type TaskListFilterInput = Omit<TaskFilter, "parentId" | "epicId"> & {
  /** Only the sub-tasks of this task. */
  readonly parent?: string;
  /** Only the tasks under this epic, at any depth. */
  readonly epic?: string;
};

/**
 * The owner's tasks, filtered. `ready: true` is the queue an agent picks its
 * next task from. The parent and the epic are named by key and resolved here,
 * so a caller never needs an id.
 */
export type ListTasksQuery = Query<"tasks.list-tasks", TaskList> & {
  readonly ownerId: string;
  readonly filter: TaskListFilterInput;
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
    const filter = resolveFilter(index, query.filter);
    return filter ? listTasks(index, filter) : { total: 0, tasks: [] };
  }
}

/**
 * The filter with its keys turned into ids, or `undefined` when a key names
 * no task (or the epic named is not an epic), so nothing can match.
 */
export function resolveFilter(
  index: TaskIndex,
  input: TaskListFilterInput,
): TaskFilter | undefined {
  const { parent, epic, ...filter } = input;
  let resolved: TaskFilter = filter;
  if (parent !== undefined) {
    const record = findRecord(index, parent);
    if (!record) return undefined;
    resolved = { ...resolved, parentId: record.id };
  }
  if (epic !== undefined) {
    const record = findRecord(index, epic);
    if (!record || record.kind !== "epic") return undefined;
    resolved = { ...resolved, epicId: record.id };
  }
  return resolved;
}

function findRecord(
  index: TaskIndex,
  reference: string,
): TaskRecord | undefined {
  const number = parseTaskKey(reference);
  return index.records.find((record) =>
    number.ok ? record.number === number.value : record.id === reference.trim(),
  );
}
