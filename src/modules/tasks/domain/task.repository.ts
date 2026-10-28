import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Task } from "./task";
import type { TaskGraph } from "./task-graph";

/**
 * Every lookup is scoped to the owner, so one person's agent can never
 * reach another's task, even with its id.
 */
export interface TaskRepository {
  findById(ownerId: string, id: string): Promise<Task | undefined>;
  findByNumber(ownerId: string, number: number): Promise<Task | undefined>;
  assignedTo(ownerId: string, userId: string): Promise<Task[]>;

  /** A race is caught by `save`. */
  nextNumber(ownerId: string): Promise<number>;

  graph(ownerId: string): Promise<TaskGraph>;

  save(task: Task): Promise<Result<void, TaskError>>;
}
