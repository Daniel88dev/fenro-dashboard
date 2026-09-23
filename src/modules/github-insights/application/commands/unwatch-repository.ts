import {
  RepositoryCoordinates,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { isErr, unwrap } from "@/shared/domain";

export type UnwatchRepositoryCommand =
  Command<"github-insights.unwatch-repository"> & {
    readonly watcherId: string;
    readonly owner: string;
    readonly name: string;
    readonly unwatchedAt?: Date;
  };

export function unwatchRepositoryCommand(
  watcherId: string,
  owner: string,
  name: string,
  unwatchedAt?: Date,
): UnwatchRepositoryCommand {
  return {
    type: "github-insights.unwatch-repository",
    watcherId,
    owner,
    name,
    unwatchedAt,
  };
}

/**
 * Unwatching something that is not watched is a no-op, not a failure. The
 * stored snapshot goes with the repository.
 */
export class UnwatchRepositoryHandler implements CommandHandler<UnwatchRepositoryCommand> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  async handle(command: UnwatchRepositoryCommand): Promise<void> {
    const coordinates = RepositoryCoordinates.create(
      command.owner,
      command.name,
    );
    if (isErr(coordinates)) {
      throw new Error(coordinates.error.message);
    }

    const existing = await this.repositories.findByCoordinates(
      command.watcherId,
      unwrap(coordinates),
    );
    if (!existing) return;

    existing.unwatch(command.unwatchedAt ?? new Date());
    await this.repositories.remove(existing.id);
  }
}
