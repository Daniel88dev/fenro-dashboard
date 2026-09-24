import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import { repositoryTasks, TaskIndex } from "./projections";
import type { RepositoryTasks } from "./read-models";

export type TasksForRepositoryQuery = Query<
  "tasks.tasks-for-repository",
  RepositoryTasks
> & {
  readonly ownerId: string;
  readonly owner: string;
  readonly name: string;
};

export function tasksForRepositoryQuery(
  ownerId: string,
  owner: string,
  name: string,
): TasksForRepositoryQuery {
  return { type: "tasks.tasks-for-repository", ownerId, owner, name };
}

export class TasksForRepositoryHandler implements QueryHandler<
  TasksForRepositoryQuery,
  RepositoryTasks
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: TasksForRepositoryQuery): Promise<RepositoryTasks> {
    const now = this.clock();
    const records = await this.tasks.records(query.ownerId);
    return repositoryTasks(
      new TaskIndex(records, now),
      query.owner,
      query.name,
      now,
    );
  }
}
