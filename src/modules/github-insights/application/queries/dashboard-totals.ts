import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, ok, type Result } from "@/shared/domain";

import type { DashboardTotals, RepositoryRow } from "./read-models";
import { loadRepositoryRows } from "./repository-rows";

export type DashboardTotalsResult = Result<
  DashboardTotals,
  InsightsUnavailable
>;

export type DashboardTotalsQuery = Query<
  "github-insights.dashboard-totals",
  DashboardTotalsResult
> & {
  readonly watcher: Watcher;
};

export function dashboardTotalsQuery(watcher: Watcher): DashboardTotalsQuery {
  return { type: "github-insights.dashboard-totals", watcher };
}

export function totalsOf(rows: readonly RepositoryRow[]): DashboardTotals {
  // A repository added by hand is never synced, so it says nothing about how
  // fresh the page is.
  const connected = rows.filter((row) => !row.manual);
  const synced = connected
    .map((row) => row.syncedAt)
    .filter((syncedAt): syncedAt is Date => syncedAt !== null);
  return {
    watchedRepositories: rows.length,
    connectedRepositories: connected.length,
    openPullRequests: rows.reduce(
      (total, row) => total + row.openPullRequests,
      0,
    ),
    openIssues: rows.reduce((total, row) => total + row.openIssues, 0),
    syncedAt:
      synced.length === 0
        ? null
        : new Date(Math.min(...synced.map((date) => date.getTime()))),
    neverSynced: connected.length - synced.length,
    rateLimited: rows.some((row) => row.rateLimited),
  };
}

export class DashboardTotalsHandler implements QueryHandler<
  DashboardTotalsQuery,
  DashboardTotalsResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async handle(query: DashboardTotalsQuery): Promise<DashboardTotalsResult> {
    const rows = await loadRepositoryRows(
      this.repositories,
      this.insights,
      query.watcher,
      this.clock(),
    );
    if (isErr(rows)) return rows;
    return ok(totalsOf(rows.value));
  }
}
