import type { SpaceMember } from "@/modules/tasks/domain";

/** Who a group's tasks can be assigned to; the groups context decides. */
export interface SpaceMembers {
  of(ownerId: string, prefix: string): Promise<readonly SpaceMember[]>;
}

export const NO_MEMBERS: SpaceMembers = { of: async () => [] };
