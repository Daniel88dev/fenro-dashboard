import { watchedRepositoryNamesQuery } from "@/modules/github-insights/application/queries/watched-repository-names";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import type { ParentOption } from "@/modules/tasks/ui/parent-select";
import type { RepositoryOption } from "@/modules/tasks/ui/repository-select";
import { getContainer } from "@/shared/infrastructure/container";

export async function tasksContext(now?: Date) {
  const container = await getContainer(now);
  const user = await container.queryBus.ask(signedInUserQuery());
  return {
    container,
    ownerId: user?.id ?? null,
    repositoryOptions: async (): Promise<RepositoryOption[]> => {
      if (!user) return [];
      const watched = await container.queryBus.ask(
        watchedRepositoryNamesQuery({ id: user.id, login: user.githubLogin }),
      );
      return watched.map(({ fullName, pinned }) => ({
        name: fullName,
        pinned,
      }));
    },
    parentOptions: async (): Promise<ParentOption[]> => {
      if (!user) return [];
      const { tasks } = await container.queryBus.ask(
        listTasksQuery(user.id, { limit: 100 }),
      );
      return [
        ...tasks.filter((task) => task.kind === "epic"),
        ...tasks.filter((task) => task.kind !== "epic"),
      ].map(({ key, title, kind }) => ({ key, title, kind }));
    },
  };
}
