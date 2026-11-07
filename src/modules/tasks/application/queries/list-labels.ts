import { defaultLabelColour, isOpen } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type {
  LabelCountRecord,
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
    const [catalogues, counts, skillLists] = await Promise.all([
      Promise.all(owners.map((owner) => this.tasks.labels(owner))),
      this.tasks.labelCounts(owners),
      Promise.all(owners.map((owner) => this.tasks.skills(owner))),
    ]);
    return labelItems(catalogues.flat(), counts, skillLists.flat());
  }
}

export function labelCounts(
  records: readonly TaskRecord[],
): LabelCountRecord[] {
  const counts = new Map<string, LabelCountRecord>();
  for (const record of records) {
    for (const name of record.labels) {
      const count = counts.get(name) ?? { name, openTasks: 0, tasks: 0 };
      counts.set(name, {
        name,
        openTasks: count.openTasks + (isOpen(record.status) ? 1 : 0),
        tasks: count.tasks + 1,
      });
    }
  }
  return [...counts.values()];
}

export function labelItems(
  catalogue: readonly LabelRecord[],
  counts: readonly LabelCountRecord[],
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
  for (const count of counts) {
    // A name a task carries is always listed, even one written before there
    // was a catalogue to add it to.
    const item = items.get(count.name) ?? {
      ...blank(count.name),
      colour: defaultLabelColour(count.name),
    };
    items.set(count.name, {
      ...item,
      openTasks: item.openTasks + count.openTasks,
      tasks: item.tasks + count.tasks,
    });
  }
  // A skill can link a name no task or catalogue entry has yet.
  for (const name of linked.keys()) {
    if (!items.has(name)) {
      items.set(name, { ...blank(name), colour: defaultLabelColour(name) });
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}
