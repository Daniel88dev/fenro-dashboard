import {
  alreadyWatched,
  RepositoryCoordinates,
  WatchedRepository,
  type AlreadyWatched,
  type InvalidCoordinates,
  type WatchedRepositoryRepository,
} from "@/modules/github-insights/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, isErr, ok, type Result } from "@/shared/domain";

export type AddRepositoryManuallyRefused = InvalidCoordinates | AlreadyWatched;

export type AddRepositoryManuallyCommand = Command<
  "github-insights.add-repository-manually",
  AddRepositoryManuallyRefused
> & {
  readonly watcherId: string;
  readonly owner: string;
  readonly name: string;
  readonly addedAt?: Date;
};

export function addRepositoryManuallyCommand(
  watcherId: string,
  owner: string,
  name: string,
  addedAt?: Date,
): AddRepositoryManuallyCommand {
  return {
    type: "github-insights.add-repository-manually",
    watcherId,
    owner,
    name,
    addedAt,
  };
}

/**
 * Puts a repository on the dashboard without asking GitHub anything, for an
 * organization that will not let this app read it. Unlike watching from the
 * picker, the coordinates come straight from a person typing, so a bad name
 * and a repository already on the list are refusals to show them, not bugs.
 */
export class AddRepositoryManuallyHandler implements CommandHandler<AddRepositoryManuallyCommand> {
  constructor(private readonly repositories: WatchedRepositoryRepository) {}

  async handle(
    command: AddRepositoryManuallyCommand,
  ): Promise<Result<void, AddRepositoryManuallyRefused>> {
    const coordinates = RepositoryCoordinates.create(
      command.owner,
      command.name,
    );
    if (isErr(coordinates)) return coordinates;

    const existing = await this.repositories.findByCoordinates(
      command.watcherId,
      coordinates.value,
    );
    const onDashboard = alreadyWatched(
      `${existing?.coordinates.fullName ?? coordinates.value.fullName} is already on your dashboard.`,
    );
    if (existing) return err(onDashboard);

    const saved = await this.repositories.save(
      WatchedRepository.addManually(
        command.watcherId,
        coordinates.value,
        command.addedAt ?? new Date(),
      ),
    );
    // Lost a race with another request adding the same repository.
    return isErr(saved) ? err(onDashboard) : ok(undefined);
  }
}
