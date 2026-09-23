import {
  RepositoryCoordinates,
  WatchedRepository,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { isErr, unwrap } from "@/shared/domain";

export type WatchRepositoryCommand =
  Command<"github-insights.watch-repository"> & {
    readonly watcherId: string;
    readonly owner: string;
    readonly name: string;
    readonly watchedAt?: Date;
  };

export function watchRepositoryCommand(
  watcherId: string,
  owner: string,
  name: string,
  watchedAt?: Date,
): WatchRepositoryCommand {
  return {
    type: "github-insights.watch-repository",
    watcherId,
    owner,
    name,
    watchedAt,
  };
}

/**
 * Watching is idempotent: one aggregate per watcher and set of coordinates, so
 * dispatching this twice leaves one watched repository rather than failing.
 * Invalid coordinates are a bug here — the route validates them before
 * dispatching, because a command bus has no way to hand a failure back.
 */
export class WatchRepositoryHandler implements CommandHandler<WatchRepositoryCommand> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  async handle(command: WatchRepositoryCommand): Promise<void> {
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
    if (existing) return;

    // A conflict means a second request watched it first, which is the
    // outcome this command wanted anyway.
    await this.repositories.save(
      WatchedRepository.watch(
        command.watcherId,
        unwrap(coordinates),
        command.watchedAt ?? new Date(),
      ),
    );
  }
}
