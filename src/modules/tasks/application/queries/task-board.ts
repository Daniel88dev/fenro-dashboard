import type { Query, QueryHandler } from "@/shared/application";

import type { TaskOwners, TaskReadStore } from "../ports/task-read-store";
import { resolveFilter, type TaskListFilterInput } from "./list-tasks";
import { board, BOARD_STATUSES, TaskIndex } from "./projections";
import type { DoneWindow, TaskBoard } from "./read-models";

export type TaskBoardQuery = Query<"tasks.task-board", TaskBoard> & {
  readonly ownerId: TaskOwners;
  readonly filter: Omit<
    TaskListFilterInput,
    "statuses" | "states" | "ready" | "includeClosed" | "limit"
  >;
  readonly done: DoneWindow;
};

export function taskBoardQuery(
  ownerId: TaskOwners,
  filter: TaskBoardQuery["filter"] = {},
  done: DoneWindow = "week",
): TaskBoardQuery {
  return { type: "tasks.task-board", ownerId, filter, done };
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
    return taskBoard(index, query.filter, query.done);
  }
}

export function taskBoard(
  index: TaskIndex,
  input: TaskBoardQuery["filter"],
  done: DoneWindow,
): TaskBoard {
  const filter = resolveFilter(index, input);
  if (!filter) {
    return {
      done,
      columns: BOARD_STATUSES.map((status) => ({
        status,
        total: 0,
        tasks: [],
        finishedEarlier: 0,
      })),
    };
  }
  return board(index, filter, done);
}
