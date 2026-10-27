import type { SpaceMember } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { SpaceMembers } from "../ports/space-members";

export type SpaceMembersQuery = Query<
  "tasks.space-members",
  readonly SpaceMember[]
> & {
  readonly ownerId: string;
  readonly keyPrefix: string;
};

export function spaceMembersQuery(
  ownerId: string,
  keyPrefix: string,
): SpaceMembersQuery {
  return { type: "tasks.space-members", ownerId, keyPrefix };
}

export class SpaceMembersHandler implements QueryHandler<
  SpaceMembersQuery,
  readonly SpaceMember[]
> {
  constructor(private readonly members: SpaceMembers) {}

  handle(query: SpaceMembersQuery): Promise<readonly SpaceMember[]> {
    return this.members.of(query.ownerId, query.keyPrefix);
  }
}
