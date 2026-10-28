import { watchedRepositoryNamesQuery } from "@/modules/github-insights/application/queries/watched-repository-names";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { nextTaskKeyQuery } from "@/modules/tasks/application/queries/next-task-key";
import { spaceMembersQuery } from "@/modules/tasks/application/queries/space-members";
import { spaceOfTask, type SpaceMember } from "@/modules/tasks/domain";
import type { ParentOption } from "@/modules/tasks/ui/parent-select";
import type { RepositoryOption } from "@/modules/tasks/ui/repository-select";
import type { SpaceOption } from "@/modules/tasks/ui/space-select";
import { getContainer } from "@/shared/infrastructure/container";

import { spacesOf } from "./spaces";

export async function tasksContext(now?: Date) {
  const container = await getContainer(now);
  const user = await container.queryBus.ask(signedInUserQuery());
  const spaces = user ? await spacesOf(container.queryBus, user) : null;
  const ask = container.queryBus.ask.bind(container.queryBus);
  const groupMembers = async (): Promise<
    Map<string, readonly SpaceMember[]>
  > => {
    if (!spaces) return new Map();
    return new Map(
      await Promise.all(
        spaces.groups.map(
          async (group) =>
            [
              group.id,
              await ask(spaceMembersQuery(group.id, group.prefix)),
            ] as const,
        ),
      ),
    );
  };
  const spaceOf = async (key: string) => {
    const space = spaces ? spaceOfTask(spaces.all, key) : undefined;
    if (!space || !user) return undefined;
    if (space.kind === "personal") return { ...space, members: [] };
    return {
      ...space,
      members: await ask(spaceMembersQuery(space.ownerId, space.prefix)),
    };
  };
  return {
    container,
    ownerId: user?.id ?? null,
    you: user ? { id: user.id, login: user.githubLogin } : null,
    spaces,
    groupMembers,
    spaceOf,
    repositoryOptions: async (): Promise<RepositoryOption[]> => {
      if (!user) return [];
      const watched = await ask(
        watchedRepositoryNamesQuery({ id: user.id, login: user.githubLogin }),
      );
      return watched.map(({ fullName, pinned }) => ({
        name: fullName,
        pinned,
      }));
    },
    /** Links never cross spaces, so only the given owners' tasks are offered. */
    parentOptions: async (
      owners: string | readonly string[] | undefined = user?.id,
    ): Promise<ParentOption[]> => {
      if (!owners || owners.length === 0) return [];
      const { tasks } = await ask(listTasksQuery(owners, { limit: 100 }));
      return [
        ...tasks.filter((task) => task.kind === "epic"),
        ...tasks.filter((task) => task.kind !== "epic"),
      ].map(({ key, title, kind }) => ({ key, title, kind }));
    },
    spaceOptions: async (): Promise<SpaceOption[]> => {
      if (!spaces) return [];
      const members = await groupMembers();
      return Promise.all(
        spaces.all.map(async (space) => {
          const count = spaces.groups.find(
            (group) => group.id === space.ownerId,
          )?.members;
          const [labels, next] = await Promise.all([
            ask(listLabelsQuery(space.ownerId)),
            ask(nextTaskKeyQuery(space.ownerId, space.prefix)),
          ]);
          return {
            prefix: space.prefix,
            name: space.name,
            kind: space.kind,
            who:
              count === undefined
                ? "Only you"
                : count === 1
                  ? "1 member"
                  : `${count} members`,
            next,
            labels,
            members: members.get(space.ownerId) ?? [],
          };
        }),
      );
    },
  };
}
