export type GroupTaskSummary = {
  readonly count: number;
  readonly nextNumber: number;
};

/** What the tasks context holds for a group. */
export interface GroupTasks {
  summary(groupId: string): Promise<GroupTaskSummary>;
}
