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
  /** When the numbers were last copied from GitHub; `null` if never. */
  readonly syncedAt: Date | null;
  /** Why the latest sync failed, while the numbers are from an older one. */
  readonly syncFailure: string | null;
  /** The latest sync was refused because GitHub's rate limit ran out. */
  readonly rateLimited: boolean;
  /** Whether opening the page should refresh this row from GitHub. */
  readonly needsSync: boolean;
};

/** What the insights reader knows about one repository, before it becomes a row. */
export type RepositoryCounts = {
  readonly repositoryId: string;
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly pullRequestHint: string;
  readonly issueHint: string;
  readonly lastActivityAt: Date | null;
};

/**
 * Totals for the page header. The task total is not here: it belongs to the
 * `tasks` context and is joined in the route.
 */
export type DashboardTotals = {
  readonly watchedRepositories: number;
  readonly openPullRequests: number;
  readonly openIssues: number;
  /**
   * The least recent sync among the repositories that have one, because the
   * page is only as fresh as its stalest row. `null` if none has synced.
   */
  readonly syncedAt: Date | null;
  readonly neverSynced: number;
  /**
   * Some repository's latest sync was refused for the rate limit, which
   * belongs to the viewer's token, so the header says it once for all rows.
   */
  readonly rateLimited: boolean;
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

/**
 * How the issues panel narrows and orders its list: the filter chips. The
 * panel's summary line still speaks for every open issue.
 */
export type IssueFilter = {
  readonly assignedToMe: boolean;
  /** Nobody has labelled it yet. */
  readonly needsTriage: boolean;
  readonly order: "attention" | "oldest";
};

export const NO_ISSUE_FILTER: IssueFilter = {
  assignedToMe: false,
  needsTriage: false,
  order: "attention",
};

export type OpenIssues = {
  readonly summary: string;
  readonly totalOpen: number;
  readonly shown: readonly IssueSummary[];
  /** How many of the stored issues pass the filter. */
  readonly matching: number;
  /**
   * Whether the last sync stored every open issue. When it did not, a filter
   * only saw the most recently updated ones, and the panel has to say so.
   */
  readonly complete: boolean;
  /** How many issues the last sync stored. */
  readonly stored: number;
};
