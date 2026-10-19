import { watchedRepositoryNamesQuery } from "@/modules/github-insights/application/queries/watched-repository-names";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { nextTaskKeyQuery } from "@/modules/tasks/application/queries/next-task-key";
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
  return {
    container,
    ownerId: user?.id ?? null,
    spaces,
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
      return Promise.all(
        spaces.all.map(async (space) => {
          const members = spaces.groups.find(
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
              members === undefined
                ? "Only you"
                : members === 1
                  ? "1 member"
                  : `${members} members`,
            next,
            labels,
          };
        }),
      );
    },
  };
}
