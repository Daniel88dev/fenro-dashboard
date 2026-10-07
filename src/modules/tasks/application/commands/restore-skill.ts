import {
  taskError,
  type SkillRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, type Result } from "@/shared/domain";

import { changeSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

/**
 * Bring back the text a skill had at an earlier revision. It is a revise like
 * any other: it makes a new revision, and is refused with `stale-skill` when
 * the skill moved on from `expectedRevision`.
 */
export type RestoreSkillCommand = TaskCommand<"tasks.restore-skill"> & {
  readonly skill: SkillReference;
  /** The revision whose text comes back. */
  readonly revision: number;
  /** The revision the editor read. */
  readonly expectedRevision: number;
};

export class RestoreSkillHandler implements CommandHandler<RestoreSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: RestoreSkillCommand): Promise<Result<void, TaskError>> {
    return changeSkill(
      this.skills,
      command.ownerId,
      command.skill,
      async (skill) => {
        const old = await this.skills.revision(
          command.ownerId,
          skill.id.value,
          command.revision,
        );
        if (!old) {
          return err(
            taskError(
              "invalid-skill",
              `Skill "${skill.name}" has no revision ${command.revision}. Read the skill to see its revisions.`,
            ),
          );
        }
        return skill.revise(
          {
            name: old.name,
            description: old.description,
            instructions: old.instructions,
          },
          command.expectedRevision,
          command.actor,
          this.clock(),
        );
      },
    );
  }
}
