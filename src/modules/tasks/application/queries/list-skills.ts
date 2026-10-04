import { normaliseLabelName } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore } from "../ports/task-read-store";
import { skillItem, TaskIndex } from "./projections";
import type { SkillItem } from "./read-models";

/** The owner's skills by name, without their instructions. */
export type ListSkillsQuery = Query<"tasks.list-skills", SkillItem[]> & {
  readonly ownerId: string;
  /** Only skills linked to this label. */
  readonly label?: string;
  /** Words that must all appear in the name or the description. */
  readonly text?: string;
};

export function listSkillsQuery(
  ownerId: string,
  filter: { readonly label?: string; readonly text?: string } = {},
): ListSkillsQuery {
  return { type: "tasks.list-skills", ownerId, ...filter };
}

export class ListSkillsHandler implements QueryHandler<
  ListSkillsQuery,
  SkillItem[]
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: ListSkillsQuery): Promise<SkillItem[]> {
    const [skills, records] = await Promise.all([
      this.tasks.skills(query.ownerId),
      this.tasks.records(query.ownerId),
    ]);
    const index = new TaskIndex(records, this.clock());
    const label = query.label ? normaliseLabelName(query.label) : undefined;
    const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);

    return skills
      .filter((skill) => !label || skill.labels.includes(label))
      .filter((skill) => {
        const haystack = `${skill.name} ${skill.description}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((skill) => skillItem(skill, index));
  }
}
