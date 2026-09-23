import {
  countsFrom,
  openIssuesFrom,
  openPullRequestsFrom,
  pullRequestChecksFrom,
} from "@/modules/github-insights/application/queries/projections";
import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type {
  RepositorySnapshot,
  RepositorySnapshotStore,
} from "@/modules/github-insights/application/ports/repository-snapshot";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type {
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  RepositoryCounts,
} from "@/modules/github-insights/application/queries/read-models";
import { ok, type Result } from "@/shared/domain";

const EMPTY: RepositorySnapshot = {
  openPullRequests: 0,
  openIssues: 0,
  lastActivityAt: null,
  pullRequests: [],
  issues: [],
};

/**
 * Ticket 05's answer behind the reader port: the screen reads what the last
 * sync stored, never GitHub. A page view therefore costs no rate limit and
 * still renders while GitHub is down.
 */
export class SnapshotInsightsReader implements RepositoryInsightsReader {
  constructor(
    private readonly snapshots: RepositorySnapshotStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async countsFor(
    watcher: Watcher,
    repositoryIds: readonly string[],
  ): Promise<Result<RepositoryCounts[], InsightsUnavailable>> {
    const snapshots = await this.snapshots.load(repositoryIds);
    return ok(
      [...snapshots].map(([id, snapshot]) => countsFrom(id, snapshot, watcher)),
    );
  }

  async openPullRequests(
    watcher: Watcher,
    repositoryId: string,
  ): Promise<Result<OpenPullRequests, InsightsUnavailable>> {
    return ok(openPullRequestsFrom(await this.#one(repositoryId), watcher));
  }

  async pullRequestChecks(
    watcher: Watcher,
    repositoryId: string,
    number: number,
  ): Promise<Result<PullRequestChecks | null, InsightsUnavailable>> {
    const pullRequest = (await this.#one(repositoryId)).pullRequests.find(
      (one) => one.number === number,
    );
    return ok(
      pullRequest
        ? pullRequestChecksFrom(pullRequest, watcher, this.clock())
        : null,
    );
  }

  async openIssues(
    watcher: Watcher,
    repositoryId: string,
  ): Promise<Result<OpenIssues, InsightsUnavailable>> {
    return ok(openIssuesFrom(await this.#one(repositoryId), watcher));
  }

  async #one(repositoryId: string): Promise<RepositorySnapshot> {
    return (
      (await this.snapshots.load([repositoryId])).get(repositoryId) ?? EMPTY
    );
  }
}
