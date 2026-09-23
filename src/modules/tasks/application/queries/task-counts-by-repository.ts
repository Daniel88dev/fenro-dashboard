import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import { countsByRepository, TaskIndex } from "./projections";
import type { TaskCountsByRepository } from "./read-models";

export type TaskCountsByRepositoryQuery = Query<
  "tasks.task-counts-by-repository",
  TaskCountsByRepository
> & { readonly ownerId: string };

export function taskCountsByRepositoryQuery(
  ownerId: string,
): TaskCountsByRepositoryQuery {
  return { type: "tasks.task-counts-by-repository", ownerId };
}

export class TaskCountsByRepositoryHandler implements QueryHandler<
  TaskCountsByRepositoryQuery,
  TaskCountsByRepository
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(
    query: TaskCountsByRepositoryQuery,
  ): Promise<TaskCountsByRepository> {
    const records = await this.tasks.records(query.ownerId);
    return countsByRepository(new TaskIndex(records, this.clock()));
  }
}
