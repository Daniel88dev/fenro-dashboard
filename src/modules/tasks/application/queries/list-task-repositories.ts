import { isOpen } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import type { TaskRepositoryItem } from "./read-models";

/** The repositories the owner's tasks name, with how many tasks name each. */
export type ListTaskRepositoriesQuery = Query<
  "tasks.list-task-repositories",
  TaskRepositoryItem[]
> & { readonly ownerId: string };

export function listTaskRepositoriesQuery(
  ownerId: string,
): ListTaskRepositoriesQuery {
  return { type: "tasks.list-task-repositories", ownerId };
}

export class ListTaskRepositoriesHandler implements QueryHandler<
  ListTaskRepositoriesQuery,
  TaskRepositoryItem[]
> {
  constructor(private readonly tasks: TaskReadStore) {}

  async handle(
    query: ListTaskRepositoriesQuery,
  ): Promise<TaskRepositoryItem[]> {
    // GitHub names are case-insensitive: tasks written as `Owner/Repo` and
    // `owner/repo` are one repository, named as the first task spelled it.
    const items = new Map<string, TaskRepositoryItem>();
    for (const record of await this.tasks.records(query.ownerId)) {
      if (!record.repository) continue;
      const name = `${record.repository.owner}/${record.repository.name}`;
      const item = items.get(name.toLowerCase()) ?? {
        name,
        openTasks: 0,
        tasks: 0,
      };
      items.set(name.toLowerCase(), {
        ...item,
        openTasks: item.openTasks + (isOpen(record.status) ? 1 : 0),
        tasks: item.tasks + 1,
      });
    }
    return [...items.values()].sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
  }
}
