import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Skill, SkillRevision } from "./skill";

export interface SkillRepository {
  findById(ownerId: string, id: string): Promise<Skill | undefined>;
  findByName(ownerId: string, name: string): Promise<Skill | undefined>;

  revision(
    ownerId: string,
    skillId: string,
    revision: number,
  ): Promise<SkillRevision | undefined>;

  save(skill: Skill): Promise<Result<void, TaskError>>;

  remove(skill: Skill): Promise<void>;
}
