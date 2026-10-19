import type { Person } from "@/modules/groups/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type {
  InvitationRecord,
  GroupReadStore,
  GroupSummaryRecord,
} from "../ports/group-read-store";

export type MyGroups = {
  readonly groups: readonly GroupSummaryRecord[];
  readonly invitations: readonly InvitationRecord[];
};

export type MyGroupsQuery = Query<"groups.my-groups", MyGroups> & {
  readonly person: Person;
};

export function myGroupsQuery(person: Person): MyGroupsQuery {
  return { type: "groups.my-groups", person };
}

export class MyGroupsHandler implements QueryHandler<MyGroupsQuery, MyGroups> {
  constructor(private readonly groups: GroupReadStore) {}

  async handle(query: MyGroupsQuery): Promise<MyGroups> {
    const [groups, invitations] = await Promise.all([
      this.groups.ofMember(query.person.id),
      this.groups.invitationsFor(query.person.login),
    ]);
    const joined = new Set(groups.map((group) => group.id));
    return {
      groups,
      invitations: invitations.filter(
        (invitation) => !joined.has(invitation.groupId),
      ),
    };
  }
}
