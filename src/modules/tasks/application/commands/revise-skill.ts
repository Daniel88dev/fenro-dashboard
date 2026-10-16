import type { SkillRepository, TaskError } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { changeSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

export type ReviseSkillCommand = TaskCommand<"tasks.revise-skill"> & {
  readonly skill: SkillReference;
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
