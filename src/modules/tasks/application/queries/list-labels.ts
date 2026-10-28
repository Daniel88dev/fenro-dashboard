import { defaultLabelColour, isOpen } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type {
  LabelRecord,
  SkillRecord,
  TaskOwners,
  TaskReadStore,
  TaskRecord,
} from "../ports/task-read-store";
import type { LabelItem } from "./read-models";

export type ListLabelsQuery = Query<"tasks.list-labels", LabelItem[]> & {
  readonly ownerId: TaskOwners;
};

export function listLabelsQuery(ownerId: TaskOwners): ListLabelsQuery {
  return { type: "tasks.list-labels", ownerId };
}

export class ListLabelsHandler implements QueryHandler<
  ListLabelsQuery,
  LabelItem[]
> {
  constructor(private readonly tasks: TaskReadStore) {}

  async handle(query: ListLabelsQuery): Promise<LabelItem[]> {
    const owners = [query.ownerId].flat();
    const [catalogues, records, skillLists] = await Promise.all([
      Promise.all(owners.map((owner) => this.tasks.labels(owner))),
      this.tasks.records(owners),
      Promise.all(owners.map((owner) => this.tasks.skills(owner))),
    ]);
    return labelItems(catalogues.flat(), records, skillLists.flat());
  }
}

export function labelItems(
  catalogue: readonly LabelRecord[],
  records: readonly TaskRecord[],
  skills: readonly SkillRecord[],
): LabelItem[] {
  const linked = new Map<string, string[]>();
  for (const skill of skills) {
    for (const name of skill.labels) {
      const names = linked.get(name) ?? [];
      if (!names.includes(skill.name)) linked.set(name, [...names, skill.name]);
    }
  }
  const blank = (name: string) => ({
    name,
    openTasks: 0,
    tasks: 0,
    skills: (linked.get(name) ?? []).sort((a, b) => a.localeCompare(b)),
  });

  const items = new Map<string, LabelItem>();
  for (const label of catalogue) {
    if (!items.has(label.name)) {
      items.set(label.name, { ...blank(label.name), colour: label.colour });
    }
  }
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
