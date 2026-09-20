import { describe, expect, it } from "vitest";

import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { unwrap } from "@/shared/domain";

import {
  UnwatchRepositoryHandler,
  unwatchRepositoryCommand,
} from "./unwatch-repository";
import {
  WatchRepositoryHandler,
  watchRepositoryCommand,
} from "./watch-repository";

const coordinates = (fullName: string) =>
  unwrap(RepositoryCoordinates.parse(fullName));

describe("watch-repository", () => {
  it("starts watching a repository", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("nordwind", "billing-core"),
    );

    const watched = await repositories.findAll();
    expect(watched.map((one) => one.coordinates.fullName)).toEqual([
      "nordwind/billing-core",
    ]);
  });

  it("refuses to watch the same repository twice", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    const handler = new WatchRepositoryHandler(repositories);

    await handler.handle(watchRepositoryCommand("nordwind", "billing-core"));
    await handler.handle(watchRepositoryCommand("nordwind", "billing-core"));

    expect(await repositories.findAll()).toHaveLength(1);
  });

  it("throws on coordinates the route should have rejected", async () => {
    const handler = new WatchRepositoryHandler(
      new InMemoryWatchedRepositoryRepository(),
    );

    await expect(
      handler.handle(watchRepositoryCommand("nord wind", "billing-core")),
    ).rejects.toThrow(/not a GitHub owner/);
  });
});

describe("unwatch-repository", () => {
  it("removes the repository from the ones being watched", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("nordwind", "billing-core"),
    );

    await new UnwatchRepositoryHandler(repositories).handle(
      unwatchRepositoryCommand("nordwind", "billing-core"),
    );

    expect(await repositories.findAll()).toEqual([]);
    expect(
      await repositories.findByCoordinates(
        coordinates("nordwind/billing-core"),
      ),
    ).toBeUndefined();
  });

  it("does nothing when the repository is not watched", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    await expect(
      new UnwatchRepositoryHandler(repositories).handle(
        unwatchRepositoryCommand("nordwind", "edge-proxy"),
      ),
    ).resolves.toBeUndefined();
  });
});
