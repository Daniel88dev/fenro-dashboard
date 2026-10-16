import type { SkillRepository, TaskError } from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

import { findSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

export type DeleteSkillCommand = TaskCommand<"tasks.delete-skill"> & {
  readonly skill: SkillReference;
};

export class DeleteSkillHandler implements CommandHandler<DeleteSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: DeleteSkillCommand): Promise<Result<void, TaskError>> {
    const found = await findSkill(this.skills, command.ownerId, command.skill);
    if (!found.ok) return found;
    found.value.delete(this.clock());
    await this.skills.remove(found.value);
    return ok(undefined);
  }
}
