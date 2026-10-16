import type { CheckConclusion, CheckRollup } from "../queries/read-models";

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
  readonly requestedReviewers: readonly string[];
  readonly approvedBy: readonly string[];
  readonly changesRequestedBy: readonly string[];
  readonly headSha: string | null;
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

export type RepositorySnapshot = {
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly lastActivityAt: Date | null;
  readonly pullRequests: readonly PullRequestRecord[];
  readonly issues: readonly IssueRecord[];
};

// The table renders far more often than any panel and the database bills
// by the byte sent, so this never carries titles or checks.
export type SnapshotCounts = {
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly lastActivityAt: Date | null;
  readonly pullRequests: readonly Pick<
    PullRequestRecord,
    "isDraft" | "requestedReviewers"
  >[];
  readonly issues: readonly Pick<IssueRecord, "assignees">[];
};

export type SnapshotParts = {
  readonly pullRequests: boolean;
  readonly issues: boolean;
};

export const ALL_PARTS: SnapshotParts = { pullRequests: true, issues: true };

export interface RepositorySnapshotStore {
  replace(repositoryId: string, snapshot: RepositorySnapshot): Promise<void>;
  load(
    repositoryIds: readonly string[],
    parts?: SnapshotParts,
  ): Promise<ReadonlyMap<string, RepositorySnapshot>>;
  loadCounts(
    repositoryIds: readonly string[],
  ): Promise<ReadonlyMap<string, SnapshotCounts>>;
}
