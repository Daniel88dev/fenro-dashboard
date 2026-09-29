import { describe, expect, it } from "vitest";

import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { isErr } from "@/shared/domain";

import {
  AddRepositoryManuallyHandler,
  addRepositoryManuallyCommand,
} from "./add-repository-manually";
import {
  WatchRepositoryHandler,
  watchRepositoryCommand,
} from "./watch-repository";

describe("add-repository-manually", () => {
  it("puts the repository on its watcher's dashboard, marked as manual", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    const added = await new AddRepositoryManuallyHandler(repositories).handle(
      addRepositoryManuallyCommand("user-1", " acme ", " billing-core "),
    );

    expect(isErr(added)).toBe(false);
    const watched = await repositories.findAllFor("user-1");
    expect(
      watched.map((one) => [one.coordinates.fullName, one.source]),
    ).toEqual([["acme/billing-core", "manual"]]);
    expect(await repositories.findAllFor("user-2")).toEqual([]);
  });

  it("refuses a name GitHub could not have", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();

    const added = await new AddRepositoryManuallyHandler(repositories).handle(
      addRepositoryManuallyCommand("user-1", "acme corp", "billing"),
    );

    expect(isErr(added) && added.error.code).toBe("invalid-coordinates");
    expect(await repositories.findAllFor("user-1")).toEqual([]);
  });

  it("refuses a repository already on the dashboard, whatever its case", async () => {
    const repositories = new InMemoryWatchedRepositoryRepository();
    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("user-1", "acme", "billing-core"),
    );

    const added = await new AddRepositoryManuallyHandler(repositories).handle(
      addRepositoryManuallyCommand("user-1", "ACME", "Billing-Core"),
    );

    expect(isErr(added) && added.error).toEqual({
      code: "already-watched",
      message: "acme/billing-core is already on your dashboard.",
    });
    const watched = await repositories.findAllFor("user-1");
    expect(watched.map((one) => one.source)).toEqual(["github"]);
  });
});
