import type { GroupReadStore } from "@/modules/groups/application/ports/group-read-store";
import type { SpaceMembers } from "@/modules/tasks/application/ports/space-members";
import type { SpaceMember } from "@/modules/tasks/domain";

export class GroupReadStoreSpaceMembers implements SpaceMembers {
  constructor(private readonly groups: GroupReadStore) {}

  async of(ownerId: string, prefix: string): Promise<readonly SpaceMember[]> {
    const group = await this.groups.detail(prefix);
    if (group?.id !== ownerId) return [];
    return group.members.map(({ userId, login }) => ({ userId, login }));
  }
}
