import {
  groupNotFound,
  type GroupError,
  type Role,
} from "@/modules/groups/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type {
  GroupDetailRecord,
  GroupReadStore,
} from "../ports/group-read-store";
import type { GroupTasks, GroupTaskSummary } from "../ports/group-tasks";

export type GroupDetail = GroupDetailRecord & {
  readonly yourRole: Role;
  readonly tasks: GroupTaskSummary;
};

export type GroupResult = Result<GroupDetail, GroupError>;

export type GroupQuery = Query<"groups.group", GroupResult> & {
  readonly prefix: string;
  readonly userId: string;
};

export function groupQuery(prefix: string, userId: string): GroupQuery {
  return {
    type: "groups.group",
    prefix: prefix.trim().toUpperCase(),
    userId,
  };
}

export class GroupHandler implements QueryHandler<GroupQuery, GroupResult> {
  constructor(
    private readonly groups: GroupReadStore,
    private readonly tasks: GroupTasks,
  ) {}

  async handle(query: GroupQuery): Promise<GroupResult> {
    const detail = await this.groups.detail(query.prefix);
    const you = detail?.members.find(
      (member) => member.userId === query.userId,
    );
    if (!detail || !you) return err(groupNotFound());
    return ok({
      ...detail,
      yourRole: you.role,
      tasks: await this.tasks.summary(detail.id),
    });
  }
}
