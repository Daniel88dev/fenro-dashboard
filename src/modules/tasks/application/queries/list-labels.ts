import { defaultLabelColour, isOpen } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import type { LabelItem } from "./read-models";

/**
 * The owner's labels by name, with how many tasks carry each and which skills
 * each brings.
 */
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
    const [catalogue, records, skills] = await Promise.all([
      this.tasks.labels(query.ownerId),
      this.tasks.records(query.ownerId),
      this.tasks.skills(query.ownerId),
    ]);

    const linked = new Map<string, string[]>();
    for (const skill of skills) {
      for (const name of skill.labels) {
        linked.set(name, [...(linked.get(name) ?? []), skill.name]);
      }
    }
    const blank = (name: string) => ({
      name,
      openTasks: 0,
      tasks: 0,
      skills: (linked.get(name) ?? []).sort((a, b) => a.localeCompare(b)),
    });

    const items = new Map<string, LabelItem>(
      catalogue.map((label) => [
        label.name,
        { ...blank(label.name), colour: label.colour },
      ]),
    );
    for (const record of records) {
      for (const name of record.labels) {
        // A name a task carries is always listed, even one written before
        // there was a catalogue to add it to.
        const item = items.get(name) ?? {
          ...blank(name),
          colour: defaultLabelColour(name),
        };
        items.set(name, {
          ...item,
          openTasks: item.openTasks + (isOpen(record.status) ? 1 : 0),
          tasks: item.tasks + 1,
        });
      }
    }
    // A skill can link a name no task or catalogue entry has yet.
    for (const name of linked.keys()) {
      if (!items.has(name)) {
        items.set(name, { ...blank(name), colour: defaultLabelColour(name) });
      }
    }
    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
