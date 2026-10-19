import {
  groupError,
  groupNotFound,
  type GroupError,
  type GroupRepository,
  type Person,
} from "@/modules/groups/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { GroupTasks } from "../ports/group-tasks";

export type DeleteGroupCommand = Command<"groups.delete-group", GroupError> & {
  readonly groupId: string;
  readonly by: Person;
};

export class DeleteGroupHandler implements CommandHandler<DeleteGroupCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly tasks: GroupTasks,
  ) {}

  async handle(command: DeleteGroupCommand): Promise<Result<void, GroupError>> {
    const group = await this.groups.findById(command.groupId);
    if (!group?.memberOf(command.by.id)) {
      return err(groupNotFound());
    }
    const allowed = group.checkCanDelete(command.by);
    if (!allowed.ok) return allowed;
    // Deleting would take every member's shared tasks with it, so an
    // group goes only once it holds none.
    const { count: tasks } = await this.tasks.summary(group.id.value);
    if (tasks > 0) {
      return err(
        groupError(
          "group-has-tasks",
          `${group.name} still holds ${tasks === 1 ? "1 task" : `${tasks} tasks`}, and deleting it would take them from every member. Only a group without tasks can be deleted.`,
        ),
      );
    }
    await this.groups.remove(group);
    return ok(undefined);
  }
}
