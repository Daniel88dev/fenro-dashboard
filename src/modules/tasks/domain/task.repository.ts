import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Task } from "./task";
import type { TaskGraph } from "./task-graph";

/**
 * Where `Task` aggregates are kept. Every lookup is scoped to the person whose
 * tasks they are, so one person's agent can never reach another's task, even
 * with its id.
 */
export interface TaskRepository {
  findById(ownerId: string, id: string): Promise<Task | undefined>;
  findByNumber(ownerId: string, number: number): Promise<Task | undefined>;

  /** The number the next task gets. A race is caught by `save`. */
  nextNumber(ownerId: string): Promise<number>;

  /** All of the owner's tasks, for the rules that span them. */
  graph(ownerId: string): Promise<TaskGraph>;

  /**
   * Fails with `concurrent-modification` when the task changed since it was
   * loaded, or when a new task's number was taken in the meantime.
   */
  save(task: Task): Promise<Result<void, TaskError>>;
}
