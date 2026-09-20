import { describe, expect, it } from "vitest";

import { unwrap } from "@/shared/domain";

import { RepositoryCoordinates } from "./repository-coordinates";
import { WatchedRepository } from "./watched-repository";

const coordinates = () =>
  unwrap(RepositoryCoordinates.create("nordwind", "billing-core"));

describe("WatchedRepository", () => {
  it("records that a repository was watched", () => {
    const watchedAt = new Date("2026-09-20T10:00:00Z");

    const repository = WatchedRepository.watch(coordinates(), watchedAt);
    const events = repository.pullDomainEvents();

    expect(repository.coordinates.fullName).toBe("nordwind/billing-core");
    expect(repository.watchedAt).toEqual(watchedAt);
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("github-insights.repository-watched");
    expect(events[0]?.aggregateId).toBe(repository.id.value);
  });

  it("hands its events over only once", () => {
    const repository = WatchedRepository.watch(coordinates(), new Date());

    expect(repository.pullDomainEvents()).toHaveLength(1);
    expect(repository.pullDomainEvents()).toHaveLength(0);
  });

  it("records that a repository was unwatched", () => {
    const repository = WatchedRepository.watch(coordinates(), new Date());
    repository.pullDomainEvents();

    repository.unwatch(new Date("2026-09-20T12:00:00Z"));

    expect(repository.pullDomainEvents().map((event) => event.name)).toEqual([
      "github-insights.repository-unwatched",
    ]);
  });

  it("restores without recording anything", () => {
    const restored = WatchedRepository.restore(
      WatchedRepository.watch(coordinates(), new Date()).id,
      { coordinates: coordinates(), watchedAt: new Date() },
    );

    expect(restored.pullDomainEvents()).toHaveLength(0);
  });
});
