import type { Query, QueryHandler } from "@/shared/application";

import type { TaskOwners, TaskReadStore } from "../ports/task-read-store";
import { labelItems } from "./list-labels";
import { repositoryItems } from "./list-task-repositories";
import { listTasksIn, type TaskListFilterInput } from "./list-tasks";
import { MAX_LIMIT, TaskIndex } from "./projections";
import type {
  DoneWindow,
  LabelItem,
  TaskBoard,
  TaskList,
  TaskListItem,
  TaskRepositoryItem,
} from "./read-models";
import { taskBoard, type TaskBoardQuery } from "./task-board";

export type TasksScreenContent =
  | { readonly layout: "list"; readonly filter: TaskListFilterInput }
  | {
      readonly layout: "board";
      readonly filter: TaskBoardQuery["filter"];
      readonly done: DoneWindow;
    };

export type TasksScreen = {
  readonly content:
    | { readonly layout: "list"; readonly list: TaskList }
    | { readonly layout: "board"; readonly board: TaskBoard };
  readonly counts: Readonly<Record<string, number>>;
  readonly epics: readonly TaskListItem[];
  readonly labels: readonly LabelItem[];
  readonly repositories: readonly TaskRepositoryItem[];
};

export type TasksScreenQuery = Query<"tasks.tasks-screen", TasksScreen> & {
  readonly ownerId: TaskOwners;
  readonly content: TasksScreenContent;
  readonly counts: Readonly<Record<string, TaskListFilterInput>>;
};

export function tasksScreenQuery(
  ownerId: TaskOwners,
  content: TasksScreenContent,
  counts: TasksScreenQuery["counts"] = {},
): TasksScreenQuery {
  return { type: "tasks.tasks-screen", ownerId, content, counts };
}

// Every list, count and facet on the page comes from one read of the tasks:
// each read is five queries, and the page needs about fifteen answers.
export class TasksScreenHandler implements QueryHandler<
  TasksScreenQuery,
  TasksScreen
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: TasksScreenQuery): Promise<TasksScreen> {
    const owners = [query.ownerId].flat();
    const [records, catalogues, skillLists] = await Promise.all([
      this.tasks.records(owners),
      Promise.all(owners.map((owner) => this.tasks.labels(owner))),
      Promise.all(owners.map((owner) => this.tasks.skills(owner))),
    ]);
    const index = new TaskIndex(records, this.clock());
    const { content } = query;
    return {
      content:
        content.layout === "board"
          ? {
              layout: "board",
              board: taskBoard(index, content.filter, content.done),
            }
          : { layout: "list", list: listTasksIn(index, content.filter) },
      counts: Object.fromEntries(
        Object.entries(query.counts).map(([name, filter]) => [
          name,
          listTasksIn(index, { ...filter, limit: 1 }).total,
        ]),
      ),
      epics: listTasksIn(index, { kinds: ["epic"], limit: MAX_LIMIT }).tasks,
      labels: labelItems(catalogues.flat(), records, skillLists.flat()),
      repositories: repositoryItems(records),
    };
  }
}
