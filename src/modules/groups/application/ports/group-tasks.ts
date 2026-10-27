import type { Person } from "@/modules/groups/domain";

export type GroupTaskSummary = {
  readonly count: number;
  readonly nextNumber: number;
};

/** What the tasks context holds for a group. */
export interface GroupTasks {
  summary(groupId: string): Promise<GroupTaskSummary>;
  /** Unassigns everything in the group that was assigned to them. */
  release(groupId: string, userId: string, by: Person): Promise<void>;
}
