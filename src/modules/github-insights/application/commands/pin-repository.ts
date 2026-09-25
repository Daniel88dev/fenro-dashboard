import {
  RepositoryCoordinates,
  type WatchedRepository,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { isErr, isOk, unwrap } from "@/shared/domain";

export type PinRepositoryCommand = Command<"github-insights.pin-repository"> & {
  readonly watcherId: string;
  readonly owner: string;
  readonly name: string;
  readonly pinnedAt?: Date;
};

export function pinRepositoryCommand(
  watcherId: string,
  owner: string,
  name: string,
  pinnedAt?: Date,
): PinRepositoryCommand {
  return {
    type: "github-insights.pin-repository",
    watcherId,
    owner,
    name,
    pinnedAt,
  };
}

export type UnpinRepositoryCommand =
  Command<"github-insights.unpin-repository"> & {
    readonly watcherId: string;
    readonly owner: string;
    readonly name: string;
    readonly unpinnedAt?: Date;
  };

export function unpinRepositoryCommand(
  watcherId: string,
  owner: string,
  name: string,
  unpinnedAt?: Date,
): UnpinRepositoryCommand {
  return {
    type: "github-insights.unpin-repository",
    watcherId,
    owner,
    name,
    unpinnedAt,
  };
}

/**
 * Pinning keeps a repository at the top of its watcher's table. Pinning one
 * that is pinned, or one that is not watched, changes nothing.
 */
export class PinRepositoryHandler implements CommandHandler<PinRepositoryCommand> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  handle(command: PinRepositoryCommand): Promise<void> {
    const at = command.pinnedAt ?? new Date();
    return change(this.repositories, command, (repository) =>
      repository.pin(at),
    );
  }
}

export class UnpinRepositoryHandler implements CommandHandler<UnpinRepositoryCommand> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  handle(command: UnpinRepositoryCommand): Promise<void> {
    const at = command.unpinnedAt ?? new Date();
    return change(this.repositories, command, (repository) =>
      repository.unpin(at),
    );
  }
}

/**
 * A sync saves the same aggregate when it starts and when it ends, so a pin
 * pressed while one runs can lose the race for the version. The person asked
 * for nothing the sync contradicts, so it loads again and tries once more.
 */
async function change(
  repositories: WatchedRepositoryRepository,
  command: { watcherId: string; owner: string; name: string },
  apply: (repository: WatchedRepository) => void,
): Promise<void> {
  const coordinates = RepositoryCoordinates.create(command.owner, command.name);
  if (isErr(coordinates)) {
    throw new Error(coordinates.error.message);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const repository = await repositories.findByCoordinates(
      command.watcherId,
      unwrap(coordinates),
    );
    if (!repository) return;
    const before = repository.pinnedAt;
    apply(repository);
    // Nothing to save, and saving anyway could cost a running sync its turn.
    if (repository.pinnedAt === before) return;
    if (isOk(await repositories.save(repository))) return;
  }
}
