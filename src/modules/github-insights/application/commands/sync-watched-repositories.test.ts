import { describe, expect, it } from "vitest";

import {
  aPullRequest,
  aSnapshot,
} from "@/modules/github-insights/application/ports/repository-snapshot.fixtures";
import { gitHubFailure } from "@/modules/github-insights/application/ports/github-gateway";
import { FakeGitHubGateway } from "@/modules/github-insights/infrastructure/fake-github.gateway";
import { InMemoryRepositorySnapshotStore } from "@/modules/github-insights/infrastructure/in-memory-repository-snapshot.store";
import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { SYNC_POLICY } from "@/modules/github-insights/domain";

import { PinRepositoryHandler, pinRepositoryCommand } from "./pin-repository";
import {
  SYNC_CONCURRENCY,
  SyncWatchedRepositoriesHandler,
  syncWatchedRepositoriesCommand,
} from "./sync-watched-repositories";
import {
  WatchRepositoryHandler,
  watchRepositoryCommand,
} from "./watch-repository";

const MINUTE = 60_000;
const t0 = new Date("2026-09-23T10:00:00Z");

async function setUp(...fullNames: string[]) {
  let now = t0;
  const clock = () => now;
  const repositories = new InMemoryWatchedRepositoryRepository();
  const snapshots = new InMemoryRepositorySnapshotStore();
  const gitHub = new FakeGitHubGateway();

  for (const fullName of fullNames) {
    const [owner, name] = fullName.split("/") as [string, string];
    await new WatchRepositoryHandler(repositories).handle(
      watchRepositoryCommand("user-1", owner, name, t0),
    );
    gitHub.set(
      fullName,
      aSnapshot({ pullRequests: [aPullRequest({ title: fullName })] }),
    );
  }

  const handler = new SyncWatchedRepositoriesHandler(
    repositories,
    gitHub,
    snapshots,
    clock,
  );
  const stored = async (fullName: string) => {
    const [repository] = (await repositories.findAllFor("user-1")).filter(
      (one) => one.coordinates.fullName === fullName,
    );
    return {
      repository: repository!,
      snapshot: (await snapshots.load([repository!.id.value])).get(
        repository!.id.value,
      ),
    };
  };
  return {
    repositories,
    snapshots,
    gitHub,
    handler,
    stored,
    advance: (milliseconds: number) => {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

describe("sync-watched-repositories", () => {
  it("copies every never-synced repository from GitHub on the first visit", async () => {
    const { handler, gitHub, stored } = await setUp(
      "nordwind/billing-core",
      "nordwind/edge-proxy",
    );

    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    expect(gitHub.calls.sort()).toEqual([
      "snapshot nordwind/billing-core",
      "snapshot nordwind/edge-proxy",
    ]);
    const billing = await stored("nordwind/billing-core");
    expect(billing.repository.sync.lastSyncedAt).toEqual(t0);
    expect(billing.snapshot?.pullRequests[0]?.title).toBe(
      "nordwind/billing-core",
    );
  });

  it("does not call GitHub on a visit within the hour", async () => {
    const { handler, gitHub, advance } = await setUp("nordwind/billing-core");
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));
    gitHub.calls.length = 0;

    advance(59 * MINUTE);
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    expect(gitHub.calls).toEqual([]);
  });

  it("syncs again once the numbers are an hour old", async () => {
    const { handler, gitHub, advance } = await setUp("nordwind/billing-core");
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));
    gitHub.calls.length = 0;

    advance(SYNC_POLICY.staleAfterMs);
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    expect(gitHub.calls).toEqual(["snapshot nordwind/billing-core"]);
  });

  it("syncs on Refresh even while the numbers are fresh", async () => {
    const { handler, gitHub, advance } = await setUp("nordwind/billing-core");
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));
    gitHub.calls.length = 0;

    advance(5 * MINUTE);
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "manual"));

    expect(gitHub.calls).toEqual(["snapshot nordwind/billing-core"]);
  });

  it("keeps the last good snapshot when GitHub fails, and says why", async () => {
    const { handler, gitHub, stored, advance } = await setUp(
      "nordwind/billing-core",
    );
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    gitHub.failure = gitHubFailure("github-unavailable", "GitHub is down.");
    advance(2 * MINUTE);
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "manual"));

    const billing = await stored("nordwind/billing-core");
    expect(billing.repository.sync.lastFailure).toBe("GitHub is down.");
    expect(billing.repository.sync.lastSyncedAt).toEqual(t0);
    expect(billing.repository.sync.isInProgress(t0)).toBe(false);
    expect(billing.snapshot?.pullRequests).toHaveLength(1);
  });

  it("does not hammer GitHub while it is failing", async () => {
    const { handler, gitHub, advance } = await setUp("nordwind/billing-core");
    gitHub.failure = gitHubFailure("github-unavailable", "GitHub is down.");
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));
    gitHub.calls.length = 0;

    advance(MINUTE);
    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    expect(gitHub.calls).toEqual([]);
  });

  it("stops asking GitHub once its rate limit has run out", async () => {
    const names = Array.from(
      { length: SYNC_CONCURRENCY + 2 },
      (_, index) => `nordwind/repo-${index}`,
    );
    const { handler, gitHub, stored } = await setUp(...names);
    gitHub.failure = gitHubFailure(
      "github-rate-limited",
      "GitHub's rate limit is used up for now. Try again later.",
    );

    await handler.handle(syncWatchedRepositoriesCommand("user-1", "automatic"));

    expect(gitHub.calls.length).toBeLessThanOrEqual(SYNC_CONCURRENCY);
    const first = await stored("nordwind/repo-0");
    expect(first.repository.sync.isRateLimited).toBe(true);
    const last = await stored(names.at(-1)!);
    expect(last.repository.sync.lastAttemptedAt).toBeNull();
  });

  it("makes one GitHub call when two requests sync at once", async () => {
    const { handler, gitHub } = await setUp("nordwind/billing-core");

    await Promise.all([
      handler.handle(syncWatchedRepositoriesCommand("user-1", "manual")),
      handler.handle(syncWatchedRepositoriesCommand("user-1", "manual")),
    ]);

    expect(gitHub.calls).toEqual(["snapshot nordwind/billing-core"]);
  });

  it("only syncs the watcher's own repositories", async () => {
    const { handler, gitHub } = await setUp("nordwind/billing-core");

    await handler.handle(syncWatchedRepositoriesCommand("user-2", "manual"));

    expect(gitHub.calls).toEqual([]);
  });

  it("keeps a pin made while GitHub is being read, and still records the sync", async () => {
    const { handler, gitHub, repositories, stored } = await setUp(
      "nordwind/billing-core",
    );
    const fetch = gitHub.fetchSnapshot.bind(gitHub);
    gitHub.fetchSnapshot = async (coordinates) => {
      await new PinRepositoryHandler(repositories).handle(
        pinRepositoryCommand("user-1", "nordwind", "billing-core", t0),
      );
      return fetch(coordinates);
    };

    await handler.handle(syncWatchedRepositoriesCommand("user-1", "manual"));

    const billing = await stored("nordwind/billing-core");
    expect(billing.repository.isPinned).toBe(true);
    expect(billing.repository.sync.lastSyncedAt).toEqual(t0);
    expect(billing.repository.sync.isInProgress(t0)).toBe(false);
  });
});
