import { readTaskKey } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type {
  TaskOwners,
  TaskRecord,
  TaskReadStore,
} from "../ports/task-read-store";
import {
  listTasks,
  matchesKey,
  TaskIndex,
  type TaskFilter,
} from "./projections";
import type { TaskList } from "./read-models";

export type TaskListFilterInput = Omit<TaskFilter, "parentId" | "epicId"> & {
  readonly parent?: string;
  readonly epic?: string;
};

export type ListTasksQuery = Query<"tasks.list-tasks", TaskList> & {
  readonly ownerId: TaskOwners;
  readonly filter: TaskListFilterInput;
};

export function listTasksQuery(
  ownerId: TaskOwners,
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
  const key = readTaskKey(reference);
  return index.records.find((record) =>
    key.ok ? matchesKey(record, key.value) : record.id === reference.trim(),
  );
}
