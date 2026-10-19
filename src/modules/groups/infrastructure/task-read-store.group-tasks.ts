import type {
  GroupTasks,
  GroupTaskSummary,
} from "@/modules/groups/application/ports/group-tasks";
import type { TaskReadStore } from "@/modules/tasks/application/ports/task-read-store";

export class TaskReadStoreGroupTasks implements GroupTasks {
  constructor(private readonly tasks: TaskReadStore) {}

  async summary(groupId: string): Promise<GroupTaskSummary> {
    const records = await this.tasks.records(groupId);
    const last = records.reduce(
      (highest, record) => Math.max(highest, record.number),
      0,
    );
    return { count: records.length, nextNumber: last + 1 };
  }
}
