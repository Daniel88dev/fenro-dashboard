import { defaultLabelColour, isOpen } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import type { LabelItem } from "./read-models";

/** The owner's labels by name, with how many tasks carry each. */
export type ListLabelsQuery = Query<"tasks.list-labels", LabelItem[]> & {
  readonly ownerId: string;
};

export function listLabelsQuery(ownerId: string): ListLabelsQuery {
  return { type: "tasks.list-labels", ownerId };
}

export class ListLabelsHandler implements QueryHandler<
  ListLabelsQuery,
  LabelItem[]
> {
  constructor(private readonly tasks: TaskReadStore) {}

  async handle(query: ListLabelsQuery): Promise<LabelItem[]> {
    const [catalogue, records] = await Promise.all([
      this.tasks.labels(query.ownerId),
      this.tasks.records(query.ownerId),
    ]);

    const items = new Map<string, LabelItem>(
      catalogue.map((label) => [
        label.name,
        { name: label.name, colour: label.colour, openTasks: 0, tasks: 0 },
      ]),
    );
    for (const record of records) {
      for (const name of record.labels) {
        // A name a task carries is always listed, even one written before
        // there was a catalogue to add it to.
        const item = items.get(name) ?? {
          name,
          colour: defaultLabelColour(name),
          openTasks: 0,
          tasks: 0,
        };
        items.set(name, {
          ...item,
          openTasks: item.openTasks + (isOpen(record.status) ? 1 : 0),
          tasks: item.tasks + 1,
        });
      }
    }
    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
