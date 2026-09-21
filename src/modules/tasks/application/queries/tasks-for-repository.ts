import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReader } from "../ports/task-reader";
import type { RepositoryTasks } from "./read-models";

export type TasksForRepositoryQuery = Query<
  "tasks.tasks-for-repository",
  RepositoryTasks
> & {
  readonly owner: string;
  readonly name: string;
};

export function tasksForRepositoryQuery(
  owner: string,
  name: string,
): TasksForRepositoryQuery {
  return { type: "tasks.tasks-for-repository", owner, name };
}

export class TasksForRepositoryHandler implements QueryHandler<
  TasksForRepositoryQuery,
  RepositoryTasks
> {
  constructor(private readonly tasks: TaskReader) {}

  handle(query: TasksForRepositoryQuery): Promise<RepositoryTasks> {
    return this.tasks.forRepository(query.owner, query.name);
  }
}
