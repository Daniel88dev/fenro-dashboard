import { describe, expect, it } from "vitest";

import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { unwrap } from "@/shared/domain";

import {
  WatchedRepositoryNamesHandler,
  watchedRepositoryNamesQuery,
} from "./watched-repository-names";

const daniel = { id: "user-1", login: "Daniel88dev" };
const someoneElse = { id: "user-2", login: "someone" };
const since = new Date("2026-09-20T00:00:00Z");

function watched(watcherId: string, fullName: string, pinned = false) {
  const repository = WatchedRepository.watch(
    watcherId,
    unwrap(RepositoryCoordinates.parse(fullName)),
    since,
  );
  if (pinned) repository.pin(since);
  return repository;
}

describe("watched repository names", () => {
  it("lists the watcher's repositories, pinned first, then alphabetically", async () => {
    const handler = new WatchedRepositoryNamesHandler(
      new InMemoryWatchedRepositoryRepository([
        watched(daniel.id, "nordwind/docs-site"),
        watched(daniel.id, "nordwind/billing-core"),
        watched(daniel.id, "Daniel88dev/fenro-dashboard", true),
        watched(someoneElse.id, "someone/private"),
      ]),
    );

    const names = await handler.handle(watchedRepositoryNamesQuery(daniel));

    expect(names).toEqual([
      { fullName: "Daniel88dev/fenro-dashboard", pinned: true },
      { fullName: "nordwind/billing-core", pinned: false },
      { fullName: "nordwind/docs-site", pinned: false },
    ]);
  });
});
