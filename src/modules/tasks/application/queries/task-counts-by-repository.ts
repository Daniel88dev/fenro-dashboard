import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReader } from "../ports/task-reader";
import type { TaskCountsByRepository } from "./read-models";

export type TaskCountsByRepositoryQuery = Query<
  "tasks.task-counts-by-repository",
  TaskCountsByRepository
>;

export function taskCountsByRepositoryQuery(): TaskCountsByRepositoryQuery {
  return { type: "tasks.task-counts-by-repository" };
}

export class TaskCountsByRepositoryHandler implements QueryHandler<
  TaskCountsByRepositoryQuery,
  TaskCountsByRepository
> {
  constructor(private readonly tasks: TaskReader) {}

  handle(): Promise<TaskCountsByRepository> {
    return this.tasks.countsByRepository();
  }
}
