import { describe, expect, it } from "vitest";

import { InMemoryRepositoryInsightsReader } from "@/modules/github-insights/infrastructure/in-memory-repository-insights.reader";
import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { sampleWatchedRepositories } from "@/modules/github-insights/infrastructure/sample-watched-repositories";
import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { unwrap } from "@/shared/domain";

import { DashboardTotalsHandler } from "./dashboard-totals";
import { RepositoryRowsHandler } from "./repository-rows";

const now = new Date("2026-09-20T12:00:00Z");

const reader = () =>
  new InMemoryRepositoryInsightsReader(
    { login: "Daniel88dev" },
    undefined,
    () => now,
  );

describe("repository-rows", () => {
  it("gives every watched repository a row, with the counts the reader has", async () => {
    const handler = new RepositoryRowsHandler(
      new InMemoryWatchedRepositoryRepository(sampleWatchedRepositories(now)),
      reader(),
    );

    const rows = unwrap(await handler.handle());

    expect(rows).toHaveLength(6);
    const billing = rows.find((row) => row.name === "billing-core");
    expect(billing).toMatchObject({
      owner: "nordwind",
      openPullRequests: 12,
      openIssues: 38,
      pullRequestHint: "3 need you",
      issueHint: "4 assigned",
    });
    expect(billing?.lastActivityAt).toEqual(new Date("2026-09-20T11:34:00Z"));
  });

  it("shows a repository the reader knows nothing about, with zeroes", async () => {
    const coordinates = unwrap(
      RepositoryCoordinates.parse("Daniel88dev/brand-new"),
    );
    const handler = new RepositoryRowsHandler(
      new InMemoryWatchedRepositoryRepository([
        WatchedRepository.watch(coordinates, now),
      ]),
      reader(),
    );

    const rows = unwrap(await handler.handle());

    expect(rows).toEqual([
      expect.objectContaining({
        owner: "Daniel88dev",
        name: "brand-new",
        openPullRequests: 0,
        openIssues: 0,
        lastActivityAt: null,
      }),
    ]);
  });
});

describe("dashboard-totals", () => {
  it("adds the counts up across everything watched", async () => {
    const handler = new DashboardTotalsHandler(
      new InMemoryWatchedRepositoryRepository(sampleWatchedRepositories(now)),
      reader(),
    );

    expect(unwrap(await handler.handle())).toEqual({
      watchedRepositories: 6,
      openPullRequests: 32,
      openIssues: 103,
    });
  });
});
