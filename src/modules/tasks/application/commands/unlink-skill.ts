import type { SkillRepository, TaskError } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { changeSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

/**
 * Stop applying a skill through these labels. The labels stay in the
 * catalogue and on tasks; names not linked are ignored.
 */
export type UnlinkSkillCommand = TaskCommand<"tasks.unlink-skill"> & {
  readonly skill: SkillReference;
  readonly labels: readonly string[];
};

export class UnlinkSkillHandler implements CommandHandler<UnlinkSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: UnlinkSkillCommand): Promise<Result<void, TaskError>> {
    return changeSkill(this.skills, command.ownerId, command.skill, (skill) =>
      skill.unlink(command.labels, command.actor, this.clock()),
    );
  }
}
