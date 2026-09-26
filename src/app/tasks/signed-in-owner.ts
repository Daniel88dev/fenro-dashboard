import { watchedRepositoryNamesQuery } from "@/modules/github-insights/application/queries/watched-repository-names";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { RepositoryOption } from "@/modules/tasks/ui/repository-select";
import { getContainer } from "@/shared/infrastructure/container";

/** The container for this request and whose tasks it shows, if anyone's. */
export async function tasksContext(now?: Date) {
  const container = await getContainer(now);
  const user = await container.queryBus.ask(signedInUserQuery());
  return {
    container,
    ownerId: user?.id ?? null,
    /**
     * The repositories a task can name: the ones this person watches on the
     * dashboard. The route joins the two contexts, so `tasks` never asks
     * `github-insights` itself.
     */
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
  };
}
