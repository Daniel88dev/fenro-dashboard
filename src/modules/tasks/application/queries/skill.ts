import { skillNotFound, type TaskError } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { skillLookup } from "../commands/skill-commands";
import type { TaskReadStore } from "../ports/task-read-store";
import { skillItem, skillRevisionItem, TaskIndex } from "./projections";
import type { SkillDetail } from "./read-models";

export type SkillResult = Result<SkillDetail, TaskError>;

export const DEFAULT_SKILL_REVISIONS = 20;

/** One skill in full, named by name or id, with its latest revisions. */
export type SkillQuery = Query<"tasks.skill", SkillResult> & {
  readonly ownerId: string;
  readonly skill: string;
  /** How many of the latest revisions to include, the current one first. */
  readonly revisions?: number;
};

export function skillQuery(
  ownerId: string,
  skill: string,
  revisions?: number,
): SkillQuery {
  return { type: "tasks.skill", ownerId, skill, revisions };
}

export class SkillHandler implements QueryHandler<SkillQuery, SkillResult> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: SkillQuery): Promise<SkillResult> {
    const [found, records] = await Promise.all([
      this.tasks.skill(
        query.ownerId,
        skillLookup(query.skill),
        Math.max(query.revisions ?? DEFAULT_SKILL_REVISIONS, 1),
      ),
      this.tasks.records(query.ownerId),
    ]);
    if (!found) return err(skillNotFound(query.skill.trim()));

    return ok({
      ...skillItem(found, new TaskIndex(records, this.clock())),
      instructions: found.instructions,
      createdBy: found.createdByName,
      createdByKind: found.createdByKind,
      createdAt: found.createdAt.toISOString(),
      revisions: found.revisions.map(skillRevisionItem),
    });
  }
}
