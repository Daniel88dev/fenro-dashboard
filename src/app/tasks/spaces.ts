import type { SignedInUser } from "@/modules/identity/application/ports/authenticator";
import {
  myGroupsQuery,
  type MyGroups,
} from "@/modules/groups/application/queries/my-groups";
import {
  personalSpace,
  spaceOfTask,
  type TaskSpace,
} from "@/modules/tasks/domain";
import type { QueryBus } from "@/shared/application";

export type Spaces = {
  readonly all: readonly TaskSpace[];
  readonly groups: MyGroups["groups"];
  readonly personal: TaskSpace;
  /**
   * The owner a task key belongs to. A key in no space of yours falls back to
   * your personal space, where the prefix check then reports it missing.
   */
  ownerOf(reference: string): string;
};

export async function spacesOf(
  queryBus: QueryBus,
  user: SignedInUser,
): Promise<Spaces> {
  const { groups } = await queryBus.ask(
    myGroupsQuery({ id: user.id, login: user.githubLogin }),
  );
  const personal = personalSpace(user.id);
  const all: TaskSpace[] = [
    personal,
    ...groups.map((group): TaskSpace => ({
      ownerId: group.id,
      prefix: group.prefix,
      name: group.name,
      kind: "group",
    })),
  ];
  return {
    all,
    groups,
    personal,
    ownerOf: (reference) => (spaceOfTask(all, reference) ?? personal).ownerId,
  };
}
