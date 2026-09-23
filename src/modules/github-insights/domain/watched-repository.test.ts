import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import { RepositoryCoordinates } from "./repository-coordinates";
import { WatchedRepository } from "./watched-repository";

const coordinates = () =>
  unwrap(RepositoryCoordinates.create("nordwind", "billing-core"));

const t0 = new Date("2026-09-23T10:00:00Z");

describe("WatchedRepository", () => {
  it("records that a repository was watched, and by whom", () => {
    const watchedAt = new Date("2026-09-20T10:00:00Z");

    const repository = WatchedRepository.watch(
      "user-1",
      coordinates(),
      watchedAt,
    );
    const events = repository.pullDomainEvents();

    expect(repository.watcherId).toBe("user-1");
    expect(repository.coordinates.fullName).toBe("nordwind/billing-core");
    expect(repository.watchedAt).toEqual(watchedAt);
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("github-insights.repository-watched");
    expect(events[0]?.aggregateId).toBe(repository.id.value);
  });

  it("starts out never synced, so the first visit syncs it", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);

    expect(repository.sync.lastSyncedAt).toBeNull();
    expect(repository.sync.isDueAutomatically(t0)).toBe(true);
  });

  it("hands its events over only once", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);

    expect(repository.pullDomainEvents()).toHaveLength(1);
    expect(repository.pullDomainEvents()).toHaveLength(0);
  });

  it("records that a repository was unwatched", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);
    repository.pullDomainEvents();

    repository.unwatch(new Date("2026-09-20T12:00:00Z"));

    expect(repository.pullDomainEvents().map((event) => event.name)).toEqual([
      "github-insights.repository-unwatched",
    ]);
  });

  it("records a sync that succeeded", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);
    repository.pullDomainEvents();

    unwrap(repository.startSync("automatic", t0));
    repository.completeSync(t0);

    expect(repository.sync.lastSyncedAt).toEqual(t0);
    expect(repository.pullDomainEvents().map((event) => event.name)).toEqual([
      "github-insights.repository-synced",
    ]);
  });

  it("records a sync that failed, with the reason", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);
    repository.pullDomainEvents();

    unwrap(repository.startSync("manual", t0));
    repository.failSync("GitHub is unavailable.", t0);

    expect(repository.sync.lastFailure).toBe("GitHub is unavailable.");
    expect(repository.pullDomainEvents()).toEqual([
      expect.objectContaining({
        name: "github-insights.repository-sync-failed",
        reason: "GitHub is unavailable.",
      }),
    ]);
  });

  it("refuses to start a sync the policy does not allow, and changes nothing", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);
    unwrap(repository.startSync("manual", t0));

    const second = repository.startSync("manual", t0);

    expect(isErr(second)).toBe(true);
    expect(repository.sync.startedAt).toEqual(t0);
  });

  it("treats finishing a sync nobody started as a bug", () => {
    const repository = WatchedRepository.watch("user-1", coordinates(), t0);

    expect(() => repository.completeSync(t0)).toThrow(/No sync is running/);
  });

  it("restores without recording anything", () => {
    const restored = WatchedRepository.restore(
      WatchedRepository.watch("user-1", coordinates(), t0).id,
      { watcherId: "user-1", coordinates: coordinates(), watchedAt: t0 },
    );

    expect(restored.pullDomainEvents()).toHaveLength(0);
  });
});
