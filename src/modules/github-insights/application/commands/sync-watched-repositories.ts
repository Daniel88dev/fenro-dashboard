import type { GitHubGateway } from "@/modules/github-insights/application/ports/github-gateway";
import type { RepositorySnapshotStore } from "@/modules/github-insights/application/ports/repository-snapshot";
import type {
  SyncTrigger,
  WatchedRepository,
  WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { isErr } from "@/shared/domain";

export type SyncWatchedRepositoriesCommand =
  Command<"github-insights.sync-watched-repositories"> & {
    readonly watcherId: string;
    readonly trigger: SyncTrigger;
  };

export function syncWatchedRepositoriesCommand(
  watcherId: string,
  trigger: SyncTrigger,
): SyncWatchedRepositoriesCommand {
  return {
    type: "github-insights.sync-watched-repositories",
    watcherId,
    trigger,
  };
}

/**
 * GitHub is asked about a handful of repositories at once, not all thirty:
 * enough to finish quickly, few enough to stay clear of GitHub's secondary
 * rate limits on concurrent requests.
 */
export const SYNC_CONCURRENCY = 4;

/**
 * Copies GitHub into the store for every watched repository whose sync policy
 * allows it. Which ones those are is the aggregate's call, never the caller's:
 * a page can ask for a sync on every visit, and GitHub is still only asked
 * when the numbers are stale or a person pressed Refresh.
 *
 * Each repository stands alone. Claiming the sync is a save that fails if
 * another request claimed it first, so two tabs refreshing together make one
 * call per repository; and a failure is recorded on that repository while the
 * last good snapshot stays where it was. The one exception is GitHub's rate
 * limit, which belongs to the token rather than to a repository: once it runs
 * out, the repositories not yet asked about are left for a later sync.
 */
export class SyncWatchedRepositoriesHandler implements CommandHandler<SyncWatchedRepositoriesCommand> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly gitHub: GitHubGateway,
    private readonly snapshots: RepositorySnapshotStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async handle(command: SyncWatchedRepositoriesCommand): Promise<void> {
    const watched = await this.repositories.findAllFor(command.watcherId);
    const run = { rateLimited: false };
    await forEachWithConcurrency(watched, SYNC_CONCURRENCY, (repository) =>
      run.rateLimited
        ? Promise.resolve()
        : this.#sync(repository, command.trigger, run),
    );
  }

  async #sync(
    repository: WatchedRepository,
    trigger: SyncTrigger,
    run: { rateLimited: boolean },
  ): Promise<void> {
    if (isErr(repository.startSync(trigger, this.clock()))) return;
    if (isErr(await this.repositories.save(repository))) return;

    const snapshot = await this.gitHub.fetchSnapshot(repository.coordinates);
    if (isErr(snapshot)) {
      const rateLimited = snapshot.error.code === "github-rate-limited";
      if (rateLimited) run.rateLimited = true;
      repository.failSync(
        snapshot.error.message,
        this.clock(),
        rateLimited ? "rate-limited" : "failed",
      );
    } else {
      await this.snapshots.replace(repository.id.value, snapshot.value);
      repository.completeSync(this.clock());
    }
    // A conflict here means the repository was unwatched mid-sync, and there
    // is nothing left to record the outcome on.
    await this.repositories.save(repository);
  }
}

async function forEachWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await work(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, lane),
  );
}
