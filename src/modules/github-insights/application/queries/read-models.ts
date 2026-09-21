/**
 * What the screen renders. Every one of these is a plain object: read models
 * cross a React Server Component boundary, and a class instance cannot.
 */

export type RepositoryRow = {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly openPullRequests: number;
  readonly openIssues: number;
  /** "3 need you" — the reason to click the count. */
  readonly pullRequestHint: string;
  /** "4 assigned" */
  readonly issueHint: string;
  readonly lastActivityAt: Date | null;
};

/** What the insights reader knows about one repository, before it becomes a row. */
export type RepositoryCounts = Omit<RepositoryRow, "id">;

/**
 * Totals for the page header. The task total is not here: it belongs to the
 * `tasks` context and is joined in the route.
 */
export type DashboardTotals = {
  readonly watchedRepositories: number;
  readonly openPullRequests: number;
  readonly openIssues: number;
};

export type ReviewState =
  "your-review" | "changes-requested" | "approved" | "draft" | "none";

export type CheckRollup = "passed" | "failed" | "running" | "none";

export type PullRequestSummary = {
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly openedAt: Date;
  readonly reviewState: ReviewState;
  /** "2 approvals" — the state said in the reviewers' own numbers. */
  readonly reviewLabel: string;
  readonly checkRollup: CheckRollup;
  /** "1 failed" */
  readonly checkSummary: string;
};

/**
 * A panel shows what needs attention, not everything, so it carries the total
 * alongside the subset it shows.
 */
export type OpenPullRequests = {
  readonly summary: string;
  readonly totalOpen: number;
  readonly shown: readonly PullRequestSummary[];
};

export type CheckConclusion = "passed" | "failed" | "running" | "skipped";

export type PullRequestChecks = {
  readonly headSha: string;
  readonly checks: readonly {
    readonly name: string;
    readonly conclusion: CheckConclusion;
    readonly duration: string | null;
  }[];
  /** A plain sentence saying what is actually blocking the merge. */
  readonly blockingReason: string;
};

export type IssueSummary = {
  readonly number: number;
  readonly title: string;
  readonly label: string | null;
  readonly openedAt: Date;
  readonly assignee: string | null;
};

export type OpenIssues = {
  readonly summary: string;
  readonly totalOpen: number;
  readonly shown: readonly IssueSummary[];
};
