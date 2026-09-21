import type {
  CheckConclusion,
  CheckRollup,
  ReviewState,
} from "@/modules/github-insights/application/queries/read-models";

/**
 * The sample data the approved prototype was drawn from
 * (docs/ui/repository-table.md). None of it was read from GitHub: it exists so
 * the screen can be built, and every number in it is invented.
 *
 * Ages are offsets rather than instants, so the table reads the same whenever
 * it is opened.
 */

export type SampleCheck = {
  readonly name: string;
  readonly conclusion: CheckConclusion;
  readonly duration: string | null;
};

export type SamplePullRequest = {
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly openedDaysAgo: number;
  readonly reviewState: ReviewState;
  readonly reviewLabel: string;
  readonly checkRollup: CheckRollup;
  readonly checkSummary: string;
  readonly headSha: string;
  readonly blockingReason: string;
  readonly checks: readonly SampleCheck[];
};

export type SampleIssue = {
  readonly number: number;
  readonly title: string;
  readonly label: string | null;
  readonly openedDaysAgo: number;
  readonly assignee: string | null;
};

export type SampleRepository = {
  readonly owner: string;
  readonly name: string;
  readonly openPullRequests: number;
  readonly openIssues: number;
  readonly lastActivityMinutesAgo: number;
  readonly pullRequestHint: string;
  readonly issueHint: string;
  readonly pullRequestSummary: string;
  readonly issueSummary: string;
  readonly pullRequests: readonly SamplePullRequest[];
  readonly issues: readonly SampleIssue[];
};

export const SAMPLE_REPOSITORIES: readonly SampleRepository[] = [
  {
    owner: "nordwind",
    name: "billing-core",
    openPullRequests: 12,
    openIssues: 38,
    lastActivityMinutesAgo: 26,
    pullRequestHint: "3 need you",
    issueHint: "4 assigned",
    pullRequestSummary: "3 waiting on your review, 1 with failing checks",
    issueSummary: "4 assigned to you, 11 unlabelled",
    pullRequests: [
      {
        number: 482,
        title: "Split the settlement reducer into two aggregates",
        author: "mira",
        openedDaysAgo: 51,
        reviewState: "your-review",
        reviewLabel: "your review",
        checkRollup: "passed",
        checkSummary: "6 passed",
        headSha: "a91c4de",
        blockingReason:
          "Mira asked for your review 51 days ago. No changes since.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "41 s" },
          { name: "typecheck", conclusion: "passed", duration: "1 m 12 s" },
          { name: "unit tests", conclusion: "passed", duration: "2 m 48 s" },
          { name: "integration", conclusion: "passed", duration: "6 m 02 s" },
          { name: "build", conclusion: "passed", duration: "1 m 55 s" },
          { name: "Claude review", conclusion: "passed", duration: "38 s" },
        ],
      },
      {
        number: 476,
        title: "Multi-currency rounding, take two",
        author: "Daniel88dev",
        openedDaysAgo: 44,
        reviewState: "changes-requested",
        reviewLabel: "changes requested",
        checkRollup: "failed",
        checkSummary: "1 failed",
        headSha: "3f0b7c1",
        blockingReason:
          "Tom requested changes 12 days ago, and the typecheck job has been red since.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "39 s" },
          { name: "typecheck", conclusion: "failed", duration: "1 m 04 s" },
          { name: "unit tests", conclusion: "passed", duration: "2 m 51 s" },
          { name: "integration", conclusion: "skipped", duration: null },
          { name: "build", conclusion: "skipped", duration: null },
          { name: "Claude review", conclusion: "passed", duration: "44 s" },
        ],
      },
      {
        number: 488,
        title: "Idempotency keys for the payout command",
        author: "mira",
        openedDaysAgo: 9,
        reviewState: "your-review",
        reviewLabel: "your review",
        checkRollup: "running",
        checkSummary: "2 running",
        headSha: "77ab210",
        blockingReason:
          "Opened 9 days ago. Checks are still running on the latest push.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "37 s" },
          { name: "typecheck", conclusion: "passed", duration: "58 s" },
          { name: "unit tests", conclusion: "running", duration: "1 m 20 s" },
          { name: "integration", conclusion: "running", duration: "3 m 11 s" },
          { name: "build", conclusion: "passed", duration: "1 m 48 s" },
          { name: "Claude review", conclusion: "passed", duration: "35 s" },
        ],
      },
      {
        number: 491,
        title: "Drop the legacy invoice serializer",
        author: "tom",
        openedDaysAgo: 2,
        reviewState: "approved",
        reviewLabel: "2 approvals",
        checkRollup: "passed",
        checkSummary: "6 passed",
        headSha: "c02ef48",
        blockingReason:
          "Approved by Tom and Mira. Nothing is blocking the merge.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "35 s" },
          { name: "typecheck", conclusion: "passed", duration: "51 s" },
          { name: "unit tests", conclusion: "passed", duration: "2 m 30 s" },
          { name: "integration", conclusion: "passed", duration: "5 m 44 s" },
          { name: "build", conclusion: "passed", duration: "1 m 39 s" },
          { name: "Claude review", conclusion: "passed", duration: "29 s" },
        ],
      },
    ],
    issues: [
      {
        number: 1204,
        title: "Rounding drift on multi-currency refunds",
        label: "bug",
        openedDaysAgo: 18,
        assignee: "Daniel88dev",
      },
      {
        number: 1198,
        title: "Ledger snapshot job times out over 2M rows",
        label: "perf",
        openedDaysAgo: 6,
        assignee: "Daniel88dev",
      },
      {
        number: 1211,
        title: "Invoice PDF misses the tax line for reverse charge",
        label: "needs triage",
        openedDaysAgo: 2,
        assignee: null,
      },
      {
        number: 1176,
        title: "Split the payout read model from the write model",
        label: "architecture",
        openedDaysAgo: 63,
        assignee: "mira",
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-api",
    openPullRequests: 7,
    openIssues: 24,
    lastActivityMinutesAgo: 60,
    pullRequestHint: "2 need you",
    issueHint: "3 assigned",
    pullRequestSummary: "2 waiting on your review",
    issueSummary: "3 assigned to you",
    pullRequests: [
      {
        number: 118,
        title: "Retry policy for webhook delivery",
        author: "Daniel88dev",
        openedDaysAgo: 34,
        reviewState: "none",
        reviewLabel: "no reviewers",
        checkRollup: "passed",
        checkSummary: "6 passed",
        headSha: "de11a03",
        blockingReason: "Green for 34 days with nobody assigned to review it.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "28 s" },
          { name: "typecheck", conclusion: "passed", duration: "47 s" },
          { name: "unit tests", conclusion: "passed", duration: "1 m 12 s" },
          { name: "integration", conclusion: "passed", duration: "2 m 40 s" },
          { name: "build", conclusion: "passed", duration: "1 m 20 s" },
          { name: "Claude review", conclusion: "passed", duration: "31 s" },
        ],
      },
      {
        number: 121,
        title: "Read-model cache decorator",
        author: "Daniel88dev",
        openedDaysAgo: 3,
        reviewState: "draft",
        reviewLabel: "draft",
        checkRollup: "failed",
        checkSummary: "1 failed",
        headSha: "9b4c7fa",
        blockingReason:
          "Draft. The unit test job has been failing since the first push.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "26 s" },
          { name: "typecheck", conclusion: "passed", duration: "44 s" },
          { name: "unit tests", conclusion: "failed", duration: "58 s" },
          { name: "integration", conclusion: "skipped", duration: null },
          { name: "build", conclusion: "passed", duration: "1 m 18 s" },
          { name: "Claude review", conclusion: "passed", duration: "30 s" },
        ],
      },
    ],
    issues: [
      {
        number: 402,
        title: "Query bus loses the correlation id",
        label: "bug",
        openedDaysAgo: 12,
        assignee: "Daniel88dev",
      },
      {
        number: 399,
        title: "Env schema rejects an empty token too late",
        label: "bug",
        openedDaysAgo: 2,
        assignee: "Daniel88dev",
      },
      {
        number: 388,
        title: "Document the command and query naming rule",
        label: "docs",
        openedDaysAgo: 21,
        assignee: null,
      },
    ],
  },
  {
    owner: "nordwind",
    name: "edge-proxy",
    openPullRequests: 5,
    openIssues: 17,
    lastActivityMinutesAgo: 240,
    pullRequestHint: "none need you",
    issueHint: "1 assigned",
    pullRequestSummary: "nothing waiting on you",
    issueSummary: "1 assigned to you",
    pullRequests: [
      {
        number: 77,
        title: "Move rate limiting into the edge worker",
        author: "Daniel88dev",
        openedDaysAgo: 9,
        reviewState: "none",
        reviewLabel: "no reviewers",
        checkRollup: "failed",
        checkSummary: "1 failed",
        headSha: "5ac9910",
        blockingReason: "The typecheck job fails on the worker types.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "22 s" },
          { name: "typecheck", conclusion: "failed", duration: "49 s" },
          { name: "unit tests", conclusion: "passed", duration: "1 m 02 s" },
          { name: "integration", conclusion: "skipped", duration: null },
          { name: "build", conclusion: "skipped", duration: null },
          { name: "Claude review", conclusion: "passed", duration: "27 s" },
        ],
      },
    ],
    issues: [
      {
        number: 310,
        title: "Origin timeout reported as 502 instead of 504",
        label: "bug",
        openedDaysAgo: 7,
        assignee: "Daniel88dev",
      },
      {
        number: 308,
        title: "Header allowlist is case sensitive",
        label: "bug",
        openedDaysAgo: 4,
        assignee: null,
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-dashboard",
    openPullRequests: 3,
    openIssues: 11,
    lastActivityMinutesAgo: 12,
    pullRequestHint: "none need you",
    issueHint: "2 assigned",
    pullRequestSummary: "1 approved and green",
    issueSummary: "2 assigned to you, 5 unlabelled",
    pullRequests: [
      {
        number: 31,
        title: "Task context snapshots on session close",
        author: "Daniel88dev",
        openedDaysAgo: 6,
        reviewState: "approved",
        reviewLabel: "1 approval",
        checkRollup: "passed",
        checkSummary: "6 passed",
        headSha: "1d77b0e",
        blockingReason: "Approved and green. Ready whenever you are.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "19 s" },
          { name: "typecheck", conclusion: "passed", duration: "52 s" },
          { name: "unit tests", conclusion: "passed", duration: "46 s" },
          { name: "integration", conclusion: "passed", duration: "1 m 33 s" },
          { name: "build", conclusion: "passed", duration: "1 m 11 s" },
          { name: "Claude review", conclusion: "passed", duration: "24 s" },
        ],
      },
    ],
    issues: [
      {
        number: 44,
        title: "Counts refresh should be a query, not a command",
        label: "architecture",
        openedDaysAgo: 4,
        assignee: "Daniel88dev",
      },
      {
        number: 41,
        title: "Session handoff loses linked pull requests",
        label: "bug",
        openedDaysAgo: 2,
        assignee: "Daniel88dev",
      },
    ],
  },
  {
    owner: "nordwind",
    name: "docs-site",
    openPullRequests: 4,
    openIssues: 9,
    lastActivityMinutesAgo: 55,
    pullRequestHint: "1 needs you",
    issueHint: "none assigned",
    pullRequestSummary: "1 waiting on your review",
    issueSummary: "nothing assigned to you",
    pullRequests: [
      {
        number: 54,
        title: "Rewrite the deployment page for AWS",
        author: "tom",
        openedDaysAgo: 12,
        reviewState: "your-review",
        reviewLabel: "your review",
        checkRollup: "passed",
        checkSummary: "4 passed",
        headSha: "ba2019f",
        blockingReason: "Waiting on you for 12 days.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "14 s" },
          { name: "link check", conclusion: "passed", duration: "33 s" },
          { name: "build", conclusion: "passed", duration: "58 s" },
          { name: "Claude review", conclusion: "passed", duration: "21 s" },
        ],
      },
    ],
    issues: [
      {
        number: 88,
        title: "Search index misses nested headings",
        label: "bug",
        openedDaysAgo: 5,
        assignee: null,
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-worker",
    openPullRequests: 1,
    openIssues: 4,
    lastActivityMinutesAgo: 180,
    pullRequestHint: "none need you",
    issueHint: "none assigned",
    pullRequestSummary: "nothing waiting on you",
    issueSummary: "nothing assigned to you",
    pullRequests: [
      {
        number: 12,
        title: "Back off on secondary rate limits",
        author: "Daniel88dev",
        openedDaysAgo: 2,
        reviewState: "none",
        reviewLabel: "no reviewers",
        checkRollup: "passed",
        checkSummary: "4 passed",
        headSha: "6e3da77",
        blockingReason: "Green, unreviewed, 2 days old.",
        checks: [
          { name: "lint", conclusion: "passed", duration: "12 s" },
          { name: "typecheck", conclusion: "passed", duration: "31 s" },
          { name: "unit tests", conclusion: "passed", duration: "40 s" },
          { name: "build", conclusion: "passed", duration: "49 s" },
        ],
      },
    ],
    issues: [
      {
        number: 19,
        title: "Sync marks archived repos as stale",
        label: "bug",
        openedDaysAgo: 1,
        assignee: null,
      },
    ],
  },
];
