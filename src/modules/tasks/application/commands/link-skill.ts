import type {
  LabelRepository,
  SkillRepository,
  TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import { ensureLabels } from "./create-label";
import { changeSkill, type SkillReference } from "./skill-commands";
import type { TaskCommand } from "./task-commands";

/**
 * Apply a skill to every task carrying any of these labels, now and later.
 * Names the catalogue lacks are added to it, as saving a task does; names
 * already linked are left as they are.
 */
export type LinkSkillCommand = TaskCommand<"tasks.link-skill"> & {
  readonly skill: SkillReference;
  readonly labels: readonly string[];
};

export class LinkSkillHandler implements CommandHandler<LinkSkillCommand> {
  constructor(
    private readonly skills: SkillRepository,
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: LinkSkillCommand): Promise<Result<void, TaskError>> {
    const now = this.clock();
    return changeSkill(
      this.skills,
      command.ownerId,
      command.skill,
      async (skill) => {
        const before = skill.state.labels;
        const linked = skill.link(command.labels, command.actor, now);
        if (!linked.ok) return linked;
        return ensureLabels(
          this.labels,
          command.ownerId,
          skill.state.labels.filter((name) => !before.includes(name)),
          now,
        );
      },
    );
  }
}
