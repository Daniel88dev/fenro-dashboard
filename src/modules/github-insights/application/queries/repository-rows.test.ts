import { describe, expect, it } from "vitest";

import {
  aPullRequest,
  aSnapshot,
  anIssue,
} from "@/modules/github-insights/application/ports/repository-snapshot.fixtures";
import { InMemoryRepositorySnapshotStore } from "@/modules/github-insights/infrastructure/in-memory-repository-snapshot.store";
import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { SnapshotInsightsReader } from "@/modules/github-insights/infrastructure/snapshot-insights.reader";
import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { isErr, unwrap } from "@/shared/domain";

import { DashboardTotalsHandler } from "./dashboard-totals";
import {
  OpenPullRequestsHandler,
  openPullRequestsQuery,
} from "./open-pull-requests";
import { RepositoryRowsHandler, repositoryRowsQuery } from "./repository-rows";

const now = new Date("2026-09-23T12:00:00Z");
const daniel = { id: "user-1", login: "Daniel88dev" };

function watched(fullName: string, syncedAt: Date | null) {
  const repository = WatchedRepository.watch(
    daniel.id,
    unwrap(RepositoryCoordinates.parse(fullName)),
    new Date("2026-09-20T00:00:00Z"),
  );
  if (syncedAt) {
    unwrap(repository.startSync("manual", syncedAt));
    repository.completeSync(syncedAt);
  }
  return repository;
}

function setUp() {
  const billing = watched(
    "nordwind/billing-core",
    new Date("2026-09-23T11:30:00Z"),
  );
  const docs = watched("nordwind/docs-site", new Date("2026-09-23T10:00:00Z"));
  const fresh = watched("Daniel88dev/brand-new", null);
  const repositories = new InMemoryWatchedRepositoryRepository([
    billing,
    docs,
    fresh,
  ]);
  const snapshots = new InMemoryRepositorySnapshotStore({
    [billing.id.value]: aSnapshot({
      openPullRequests: 12,
      openIssues: 38,
      pullRequests: [
        aPullRequest({ number: 1, requestedReviewers: ["daniel88dev"] }),
        aPullRequest({ number: 2 }),
      ],
      issues: [anIssue({ assignees: ["Daniel88dev"] })],
    }),
    [docs.id.value]: aSnapshot({ openPullRequests: 4, openIssues: 9 }),
  });
  const insights = new SnapshotInsightsReader(snapshots, () => now);
  return { repositories, insights, billing };
}

describe("repository-rows", () => {
  it("gives every watched repository a row, with its stored counts and hints", async () => {
    const { repositories, insights } = setUp();

    const rows = unwrap(
      await new RepositoryRowsHandler(repositories, insights, () => now).handle(
        repositoryRowsQuery(daniel),
      ),
    );

    expect(rows.map((row) => `${row.owner}/${row.name}`)).toEqual([
      "Daniel88dev/brand-new",
      "nordwind/billing-core",
      "nordwind/docs-site",
    ]);
    expect(rows[1]).toMatchObject({
      openPullRequests: 12,
      openIssues: 38,
      pullRequestHint: "1 needs you",
      issueHint: "1 assigned",
      syncedAt: new Date("2026-09-23T11:30:00Z"),
      needsSync: false,
    });
  });

  it("puts pinned repositories first, alphabetical within each group", async () => {
    const { repositories, insights } = setUp();
    for (const fullName of ["nordwind/docs-site", "nordwind/billing-core"]) {
      const repository = await repositories.findByCoordinates(
        daniel.id,
        unwrap(RepositoryCoordinates.parse(fullName)),
      );
      repository!.pin(now);
      unwrap(await repositories.save(repository!));
    }

    const rows = unwrap(
      await new RepositoryRowsHandler(repositories, insights, () => now).handle(
        repositoryRowsQuery(daniel),
      ),
    );

    expect(rows.map((row) => [`${row.owner}/${row.name}`, row.pinned])).toEqual(
      [
        ["nordwind/billing-core", true],
        ["nordwind/docs-site", true],
        ["Daniel88dev/brand-new", false],
      ],
    );
  });

  it("flags rows an hour stale, or never synced, for a refresh", async () => {
    const { repositories, insights } = setUp();

    const rows = unwrap(
      await new RepositoryRowsHandler(repositories, insights, () => now).handle(
        repositoryRowsQuery(daniel),
      ),
    );

    expect(rows.find((row) => row.name === "docs-site")?.needsSync).toBe(true);
    expect(rows.find((row) => row.name === "brand-new")).toMatchObject({
      needsSync: true,
      syncedAt: null,
      openPullRequests: 0,
      pullRequestHint: "not synced yet",
    });
  });

  it("shows nobody else's repositories", async () => {
    const { repositories, insights } = setUp();

    const rows = unwrap(
      await new RepositoryRowsHandler(repositories, insights, () => now).handle(
        repositoryRowsQuery({ id: "user-2", login: "mira" }),
      ),
    );

    expect(rows).toEqual([]);
  });
});

describe("dashboard-totals", () => {
  it("adds the counts up, and is only as fresh as the stalest sync", async () => {
    const { repositories, insights } = setUp();

    expect(
      unwrap(
        await new DashboardTotalsHandler(
          repositories,
          insights,
          () => now,
        ).handle({ type: "github-insights.dashboard-totals", watcher: daniel }),
      ),
    ).toEqual({
      watchedRepositories: 3,
      openPullRequests: 16,
      openIssues: 47,
      syncedAt: new Date("2026-09-23T10:00:00Z"),
      neverSynced: 1,
      rateLimited: false,
    });
  });

  it("says the rate limit ran out when any repository's sync was refused for it", async () => {
    const { billing } = setUp();
    unwrap(billing.startSync("manual", now));
    billing.failSync("GitHub's rate limit is used up.", now, "rate-limited");
    const repositories = new InMemoryWatchedRepositoryRepository([billing]);
    const insights = new SnapshotInsightsReader(
      new InMemoryRepositorySnapshotStore(),
      () => now,
    );

    const totals = unwrap(
      await new DashboardTotalsHandler(
        repositories,
        insights,
        () => now,
      ).handle({ type: "github-insights.dashboard-totals", watcher: daniel }),
    );

    expect(totals.rateLimited).toBe(true);
  });
});

describe("open-pull-requests", () => {
  it("reads a panel only for a repository this watcher watches", async () => {
    const { repositories, insights } = setUp();
    const handler = new OpenPullRequestsHandler(repositories, insights);

    const mine = await handler.handle(
      openPullRequestsQuery(daniel, "nordwind", "billing-core"),
    );
    const theirs = await handler.handle(
      openPullRequestsQuery(
        { id: "user-2", login: "mira" },
        "nordwind",
        "billing-core",
      ),
    );

    expect(unwrap(mine).totalOpen).toBe(12);
    expect(isErr(theirs)).toBe(true);
  });
});
