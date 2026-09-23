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
  it("starts watching a repository for the person who asked", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );

    const watched = await repositories.findAllFor("user-1");
    expect(watched.map((one) => one.coordinates.fullName)).toEqual([
      "nordwind/billing-core",
    ]);
    expect(await repositories.findAllFor("user-2")).toEqual([]);
  });

  it("refuses to watch the same repository twice, whatever its case", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    const handler = new WatchRepositoryHandler(repositories);

    await handler.handle(
      watchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );
    await handler.handle(
      watchRepositoryCommand("user-1", "Nordwind", "Billing-Core"),
    );

    expect(await repositories.findAllFor("user-1")).toHaveLength(1);
  });

  it("lets two people watch the same repository", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    const handler = new WatchRepositoryHandler(repositories);

    await handler.handle(
      watchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );
    await handler.handle(
      watchRepositoryCommand("user-2", "nordwind", "billing-core"),
    );

    expect(await repositories.findAllFor("user-1")).toHaveLength(1);
    expect(await repositories.findAllFor("user-2")).toHaveLength(1);
  });

  it("throws on coordinates the route should have rejected", async () => {
    const handler = new WatchRepositoryHandler(
      new InMemoryWatchedRepositoryRepository(),
    );

    await expect(
      handler.handle(
        watchRepositoryCommand("user-1", "nord wind", "billing-core"),
      ),
    ).rejects.toThrow(/not a GitHub owner/);
  });
});

describe("unwatch-repository", () => {
  it("removes the repository from the ones being watched", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );

    await new UnwatchRepositoryHandler(repositories).handle(
      unwatchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );

    expect(await repositories.findAllFor("user-1")).toEqual([]);
    expect(
      await repositories.findByCoordinates(
        "user-1",
        coordinates("nordwind/billing-core"),
      ),
    ).toBeUndefined();
  });

  it("leaves someone else's watch alone", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("user-1", "nordwind", "billing-core"),
    );

    await new UnwatchRepositoryHandler(repositories).handle(
      unwatchRepositoryCommand("user-2", "nordwind", "billing-core"),
    );

    expect(await repositories.findAllFor("user-1")).toHaveLength(1);
  });

  it("does nothing when the repository is not watched", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    await expect(
      new UnwatchRepositoryHandler(repositories).handle(
        unwatchRepositoryCommand("user-1", "nordwind", "edge-proxy"),
      ),
    ).resolves.toBeUndefined();
  });
});
