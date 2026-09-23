import type {
  IssueRecord,
  PullRequestRecord,
  RepositorySnapshot,
} from "./repository-snapshot";

/** Builders for tests: one plausible record, overridden where a test cares. */

const t = new Date("2026-09-20T12:00:00Z");

export function aPullRequest(
  overrides: Partial<PullRequestRecord> = {},
): PullRequestRecord {
  return {
    number: 1,
    title: "A change",
    author: "mira",
    isDraft: false,
    openedAt: t,
    updatedAt: t,
    reviewDecision: null,
    requestedReviewers: [],
    approvedBy: [],
    changesRequestedBy: [],
    headSha: "a91c4de0000000000000000000000000000000000",
    checkRollup: "passed",
    checks: [],
    ...overrides,
  };
}

export function anIssue(overrides: Partial<IssueRecord> = {}): IssueRecord {
  return {
    number: 1,
    title: "A problem",
    labels: [],
    assignees: [],
    openedAt: t,
    updatedAt: t,
    ...overrides,
  };
}

export function aSnapshot(
  overrides: Partial<RepositorySnapshot> = {},
): RepositorySnapshot {
  const pullRequests = overrides.pullRequests ?? [];
  const issues = overrides.issues ?? [];
  return {
    openPullRequests: pullRequests.length,
    openIssues: issues.length,
    lastActivityAt: t,
    pullRequests,
    issues,
    ...overrides,
  };
}
