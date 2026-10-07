import type { SkillRepository, TaskError } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { changeSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

/**
 * Change a skill's name, description or instructions; what is left out stays.
 * Refused with `stale-skill` when the skill is no longer at
 * `expectedRevision`, so an editor never overwrites a change they have not
 * seen. Every revision's text is kept.
 */
export type ReviseSkillCommand = TaskCommand<"tasks.revise-skill"> & {
  readonly skill: SkillReference;
  /** The revision the editor read. */
  readonly expectedRevision: number;
  readonly name?: string;
  readonly description?: string;
  readonly instructions?: string;
};

export class ReviseSkillHandler implements CommandHandler<ReviseSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: ReviseSkillCommand): Promise<Result<void, TaskError>> {
    return changeSkill(this.skills, command.ownerId, command.skill, (skill) =>
      skill.revise(
        {
          name: command.name,
          description: command.description,
          instructions: command.instructions,
        },
        command.expectedRevision,
        command.actor,
        this.clock(),
      ),
    );
  }
}
