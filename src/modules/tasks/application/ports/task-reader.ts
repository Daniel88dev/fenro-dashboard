import type {
  RepositoryTasks,
  TaskCountsByRepository,
} from "../queries/read-models";

/**
 * Everything the dashboard reads about tasks. The write side arrives with the
 * `Task` aggregate in a later slice; this port is what the table needs now.
 */
export interface TaskReader {
  countsByRepository(): Promise<TaskCountsByRepository>;
  forRepository(owner: string, name: string): Promise<RepositoryTasks>;
}
