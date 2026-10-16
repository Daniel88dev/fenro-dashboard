// Plain objects only: read models cross a React Server Component boundary,
// and a class instance cannot.

export type RepositoryRow = {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
  readonly pinned: boolean;
  readonly manual: boolean;
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly pullRequestHint: string;
  readonly issueHint: string;
  readonly lastActivityAt: Date | null;
  readonly syncedAt: Date | null;
  readonly syncFailure: string | null;
  readonly rateLimited: boolean;
  readonly needsSync: boolean;
};

export type RepositoryCounts = {
  readonly repositoryId: string;
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly pullRequestHint: string;
  readonly issueHint: string;
  readonly lastActivityAt: Date | null;
};

export type DashboardTotals = {
  readonly watchedRepositories: number;
  readonly connectedRepositories: number;
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly syncedAt: Date | null;
  readonly neverSynced: number;
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
  readonly reviewLabel: string;
  readonly checkRollup: CheckRollup;
  readonly checkSummary: string;
};

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
  readonly blockingReason: string;
};

export type IssueSummary = {
  readonly number: number;
  readonly title: string;
  readonly label: string | null;
  readonly openedAt: Date;
  readonly assignee: string | null;
};

export type IssueFilter = {
  readonly assignedToMe: boolean;
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
  readonly matching: number;
  readonly complete: boolean;
  readonly stored: number;
};
