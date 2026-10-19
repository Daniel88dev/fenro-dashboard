import { formatTaskKey } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";

/** A preview: another task created first takes this key. */
export type NextTaskKeyQuery = Query<"tasks.next-task-key", string> & {
  readonly ownerId: string;
  readonly keyPrefix: string;
};

export function nextTaskKeyQuery(
  ownerId: string,
  keyPrefix: string,
): NextTaskKeyQuery {
  return { type: "tasks.next-task-key", ownerId, keyPrefix };
}

export class NextTaskKeyHandler implements QueryHandler<
  NextTaskKeyQuery,
  string
> {
  constructor(private readonly tasks: TaskReadStore) {}

  async handle(query: NextTaskKeyQuery): Promise<string> {
    const records = await this.tasks.records(query.ownerId);
    const last = records.reduce(
      (highest, record) => Math.max(highest, record.number),
      0,
    );
    return formatTaskKey(last + 1, query.keyPrefix);
  }
}
