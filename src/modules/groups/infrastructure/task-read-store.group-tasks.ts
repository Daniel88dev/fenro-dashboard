import type {
  GroupTasks,
  GroupTaskSummary,
} from "@/modules/groups/application/ports/group-tasks";
import type { Person } from "@/modules/groups/domain";
import type { ReleaseAssigneeCommand } from "@/modules/tasks/application/commands/release-assignee";
import type { TaskReadStore } from "@/modules/tasks/application/ports/task-read-store";
import type { CommandBus } from "@/shared/application";

export class TaskReadStoreGroupTasks implements GroupTasks {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly commands: CommandBus,
  ) {}

  async release(groupId: string, userId: string, by: Person): Promise<void> {
    const released = await this.commands.dispatch<ReleaseAssigneeCommand>({
      type: "tasks.release-assignee",
      ownerId: groupId,
      userId,
      actor: { kind: "human", id: by.id, name: by.login },
    });
    if (!released.ok) throw new Error(released.error.message);
  }

  async summary(groupId: string): Promise<GroupTaskSummary> {
    const records = await this.tasks.records(groupId);
    const last = records.reduce(
      (highest, record) => Math.max(highest, record.number),
      0,
    );
    return { count: records.length, nextNumber: last + 1 };
  }
}
