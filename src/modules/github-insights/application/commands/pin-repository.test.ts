import { describe, expect, it } from "vitest";

import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { unwrap } from "@/shared/domain";

import {
  PinRepositoryHandler,
  UnpinRepositoryHandler,
  pinRepositoryCommand,
  unpinRepositoryCommand,
} from "./pin-repository";
import {
  WatchRepositoryHandler,
  watchRepositoryCommand,
} from "./watch-repository";

const t0 = new Date("2026-09-25T10:00:00Z");

async function setUp() {
  const repositories = new InMemoryWatchedRepositoryRepository();
  await new WatchRepositoryHandler(repositories).handle(
    watchRepositoryCommand("user-1", "nordwind", "billing-core", t0),
  );
  const find = (watcherId = "user-1") =>
    repositories.findByCoordinates(
      watcherId,
      unwrap(RepositoryCoordinates.parse("nordwind/billing-core")),
    );
  return { repositories, find };
}

describe("pin-repository", () => {
  it("pins a watched repository, whatever case its name is typed in", async () => {
    const { repositories, find } = await setUp();

    await new PinRepositoryHandler(repositories).handle(
      pinRepositoryCommand("user-1", "Nordwind", "Billing-Core", t0),
    );

    expect((await find())?.pinnedAt).toEqual(t0);
  });

  it("unpins it again", async () => {
    const { repositories, find } = await setUp();
    await new PinRepositoryHandler(repositories).handle(
      pinRepositoryCommand("user-1", "nordwind", "billing-core", t0),
    );

    await new UnpinRepositoryHandler(repositories).handle(
      unpinRepositoryCommand("user-1", "nordwind", "billing-core", t0),
    );

    expect((await find())?.isPinned).toBe(false);
  });

  it("does nothing for a repository the person does not watch", async () => {
    const { repositories } = await setUp();

    await new PinRepositoryHandler(repositories).handle(
      pinRepositoryCommand("user-2", "nordwind", "billing-core", t0),
    );

    expect(await repositories.findAllFor("user-2")).toEqual([]);
  });

  it("pins even when a sync saved the repository in the meantime", async () => {
    const { repositories, find } = await setUp();
    const stale = (await find())!;
    // A sync claims the repository between this load and the pin's save.
    const syncing = (await find())!;
    unwrap(syncing.startSync("manual", t0));
    unwrap(await repositories.save(syncing));
    const findByCoordinates = repositories.findByCoordinates.bind(repositories);
    let first = true;
    repositories.findByCoordinates = (watcherId, coordinates) => {
      if (first) {
        first = false;
        return Promise.resolve(stale);
      }
      return findByCoordinates(watcherId, coordinates);
    };

    await new PinRepositoryHandler(repositories).handle(
      pinRepositoryCommand("user-1", "nordwind", "billing-core", t0),
    );

    const stored = await findByCoordinates(
      "user-1",
      unwrap(RepositoryCoordinates.parse("nordwind/billing-core")),
    );
    expect(stored?.isPinned).toBe(true);
    expect(stored?.sync.startedAt).toEqual(t0);
  });
});
