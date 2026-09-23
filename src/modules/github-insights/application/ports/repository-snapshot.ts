import type { CheckConclusion, CheckRollup } from "../queries/read-models";

/**
 * What a sync copies out of GitHub: facts about the repository, stored as
 * GitHub reported them and independent of who is looking. Whether a pull
 * request "needs you" depends on the viewer, so it is worked out when a query
 * reads these, never stored.
 */

export type CheckRecord = {
  readonly name: string;
  readonly conclusion: CheckConclusion;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
};

export type ReviewDecision =
  "approved" | "changes-requested" | "review-required";

export type PullRequestRecord = {
  readonly number: number;
  readonly title: string;
  /** `null` for a deleted account, which GitHub shows as "ghost". */
  readonly author: string | null;
  readonly isDraft: boolean;
  readonly openedAt: Date;
  readonly updatedAt: Date;
  readonly reviewDecision: ReviewDecision | null;
  /** Users by login, teams as `org/team`. */
  readonly requestedReviewers: readonly string[];
  /** Whose latest review approves. */
  readonly approvedBy: readonly string[];
  /** Whose latest review asks for changes. */
  readonly changesRequestedBy: readonly string[];
  readonly headSha: string | null;
  /** GitHub's own verdict over every check on the head commit. */
  readonly checkRollup: CheckRollup;
  readonly checks: readonly CheckRecord[];
};

export type IssueRecord = {
  readonly number: number;
  readonly title: string;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly openedAt: Date;
  readonly updatedAt: Date;
};

/**
 * One repository at one moment. The counts are GitHub's totals; the lists hold
 * the most recently updated items, which is at most what a panel shows.
 */
export type RepositorySnapshot = {
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly lastActivityAt: Date | null;
  readonly pullRequests: readonly PullRequestRecord[];
  readonly issues: readonly IssueRecord[];
};

/** Where synced snapshots are kept, keyed by the watched repository's id. */
export interface RepositorySnapshotStore {
  /** Swap the stored snapshot for a fresh one, all or nothing. */
  replace(repositoryId: string, snapshot: RepositorySnapshot): Promise<void>;
  /** Repositories never synced are simply missing from the map. */
  load(
    repositoryIds: readonly string[],
  ): Promise<ReadonlyMap<string, RepositorySnapshot>>;
}
