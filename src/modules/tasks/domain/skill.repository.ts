import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Skill, SkillRevision } from "./skill";

/** Where a person's skills are kept. Every lookup is scoped to its owner. */
export interface SkillRepository {
  findById(ownerId: string, id: string): Promise<Skill | undefined>;
  findByName(ownerId: string, name: string): Promise<Skill | undefined>;

  /** One kept revision of a skill's text. */
  revision(
    ownerId: string,
    skillId: string,
    revision: number,
  ): Promise<SkillRevision | undefined>;

  /**
   * Insert a new skill or write a loaded one's changes, appending its new
   * revisions. Fails with `skill-exists` when the name is taken, and with
   * `concurrent-modification` when the skill changed since it was loaded.
   */
  save(skill: Skill): Promise<Result<void, TaskError>>;

  /** Delete the skill with its links and revisions. */
  remove(skill: Skill): Promise<void>;
}
