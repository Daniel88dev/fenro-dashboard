import {
  Skill,
  type LabelRepository,
  type SkillRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { ensureLabels } from "./create-label";
import type { TaskCommand } from "./task-commands";

export type CreateSkillCommand = TaskCommand<"tasks.create-skill"> & {
  readonly skillId: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly labels?: readonly string[];
};

export class CreateSkillHandler implements CommandHandler<CreateSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: CreateSkillCommand): Promise<Result<void, TaskError>> {
    const now = this.clock();
    const skill = Skill.create({
      id: command.skillId,
      ownerId: command.ownerId,
      name: command.name,
      description: command.description,
      instructions: command.instructions,
      labels: command.labels,
      actor: command.actor,
      now,
    });
    if (!skill.ok) return skill;

    const labelled = await ensureLabels(
      this.labels,
      command.ownerId,
      skill.value.state.labels,
      now,
    );
    if (!labelled.ok) return labelled;
    return this.skills.save(skill.value);
  }
}
