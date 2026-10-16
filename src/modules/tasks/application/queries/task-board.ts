import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import { resolveFilter, type TaskListFilterInput } from "./list-tasks";
import { board, BOARD_STATUSES, TaskIndex } from "./projections";
import type { TaskBoard } from "./read-models";

/**
 * The owner's tasks as board columns, one per status, under the same filters
 * as the list. Moving a card is `tasks.change-status`; the board only reads.
 */
export type TaskBoardQuery = Query<"tasks.task-board", TaskBoard> & {
  readonly ownerId: string;
  readonly filter: Omit<
    TaskListFilterInput,
    "statuses" | "states" | "ready" | "includeClosed" | "limit"
  >;
};

export function taskBoardQuery(
  ownerId: string,
  filter: TaskBoardQuery["filter"] = {},
): TaskBoardQuery {
  return { type: "tasks.task-board", ownerId, filter };
}

export class TaskBoardHandler implements QueryHandler<
  TaskBoardQuery,
  TaskBoard
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: TaskBoardQuery): Promise<TaskBoard> {
    const index = new TaskIndex(
      await this.tasks.records(query.ownerId),
      this.clock(),
    );
    const filter = resolveFilter(index, query.filter);
    if (!filter) {
      return {
        columns: BOARD_STATUSES.map((status) => ({
          status,
          total: 0,
          tasks: [],
        })),
      };
    }
    return board(index, filter);
  }
}
