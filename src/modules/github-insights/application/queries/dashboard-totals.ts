import type {
  RepositoryInsightsReader,
  InsightsUnavailable,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { isErr, ok, type Result } from "@/shared/domain";

import type { DashboardTotals } from "./read-models";
import { loadRepositoryRows } from "./repository-rows";

export type DashboardTotalsResult = Result<
  DashboardTotals,
  InsightsUnavailable
>;

export type DashboardTotalsQuery = Query<
  "github-insights.dashboard-totals",
  DashboardTotalsResult
>;

export function dashboardTotalsQuery(): DashboardTotalsQuery {
  return { type: "github-insights.dashboard-totals" };
}

export class DashboardTotalsHandler implements QueryHandler<
  DashboardTotalsQuery,
  DashboardTotalsResult
> {
  constructor(
    private readonly repositories: WatchedRepositoryRepository,
    private readonly insights: RepositoryInsightsReader,
  ) {}

  async handle(): Promise<DashboardTotalsResult> {
    const rows = await loadRepositoryRows(this.repositories, this.insights);
    if (isErr(rows)) return rows;

    return ok({
      watchedRepositories: rows.value.length,
      openPullRequests: rows.value.reduce(
        (total, row) => total + row.openPullRequests,
        0,
      ),
      openIssues: rows.value.reduce((total, row) => total + row.openIssues, 0),
    });
  }
}
