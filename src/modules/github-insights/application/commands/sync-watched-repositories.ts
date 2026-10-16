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

// Few enough concurrent requests to stay clear of GitHub's secondary rate
// limits.
export const SYNC_CONCURRENCY = 4;

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

    const claimedAt = repository.sync.startedAt;
    const snapshot = await this.gitHub.fetchSnapshot(repository.coordinates);
    let finish: (one: WatchedRepository) => void;
    if (isErr(snapshot)) {
      const rateLimited = snapshot.error.code === "github-rate-limited";
      if (rateLimited) run.rateLimited = true;
      const failedAt = this.clock();
      finish = (one) =>
        one.failSync(
          snapshot.error.message,
          failedAt,
          rateLimited ? "rate-limited" : "failed",
        );
    } else {
      await this.snapshots.replace(repository.id.value, snapshot.value);
      const syncedAt = this.clock();
      finish = (one) => one.completeSync(syncedAt);
    }

    finish(repository);
    if (!isErr(await this.repositories.save(repository))) return;

    // Someone saved the repository while GitHub was being read: its watcher
    // pinned it, say. While this sync's claim is still on the stored copy, the
    // outcome is recorded on that. Nothing found means it was unwatched
    // mid-sync, and there is nothing left to record the outcome on.
    const current = await this.repositories.findById(repository.id);
    if (
      !current ||
      current.sync.startedAt?.getTime() !== claimedAt?.getTime()
    ) {
      return;
    }
    finish(current);
    await this.repositories.save(current);
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
