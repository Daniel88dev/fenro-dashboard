import type {
  CheckRecord,
  IssueRecord,
  PullRequestRecord,
  RepositorySnapshot,
} from "../ports/repository-snapshot";
import type { Watcher } from "../ports/viewer";
import type {
  CheckRollup,
  IssueSummary,
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  PullRequestSummary,
  RepositoryCounts,
  ReviewState,
} from "./read-models";

/**
 * Turns stored GitHub facts into what the screen says to one person. The same
 * snapshot reads differently to its author and to a requested reviewer, which
 * is why none of this is stored.
 */

/** How many items a panel lists before pointing at GitHub for the rest. */
export const PANEL_LIMIT = 8;

function isViewer(login: string | null, watcher: Watcher): boolean {
  return login !== null && login.toLowerCase() === watcher.login.toLowerCase();
}

function whoIs(login: string | null, watcher: Watcher): string {
  if (login === null) return "ghost";
  return isViewer(login, watcher) ? "you" : login;
}

function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function reviewStateFor(
  pullRequest: PullRequestRecord,
  watcher: Watcher,
): ReviewState {
  if (pullRequest.isDraft) return "draft";
  if (
    pullRequest.requestedReviewers.some((login) => isViewer(login, watcher))
  ) {
    return "your-review";
  }
  if (
    pullRequest.reviewDecision === "changes-requested" ||
    pullRequest.changesRequestedBy.length > 0
  ) {
    return "changes-requested";
  }
  if (
    pullRequest.reviewDecision === "approved" ||
    pullRequest.approvedBy.length > 0
  ) {
    return "approved";
  }
  return "none";
}

function reviewLabelFor(
  pullRequest: PullRequestRecord,
  state: ReviewState,
): string {
  switch (state) {
    case "draft":
      return "draft";
    case "your-review":
      return "your review";
    case "changes-requested":
      return "changes requested";
    case "approved":
      return plural(Math.max(1, pullRequest.approvedBy.length), "approval");
    case "none":
      return pullRequest.requestedReviewers.length > 0
        ? "review requested"
        : "no reviewers";
  }
}

function checkSummaryFor(pullRequest: PullRequestRecord): string {
  const count = (conclusion: CheckRecord["conclusion"]) =>
    pullRequest.checks.filter((check) => check.conclusion === conclusion)
      .length;
  switch (pullRequest.checkRollup) {
    case "failed":
      return `${Math.max(1, count("failed"))} failed`;
    case "running":
      return `${Math.max(1, count("running"))} running`;
    case "passed":
      return `${count("passed")} passed`;
    case "none":
      return "no checks";
  }
}

function needsViewer(pullRequest: PullRequestRecord, watcher: Watcher) {
  return reviewStateFor(pullRequest, watcher) === "your-review";
}

function isAssignedTo(issue: IssueRecord, watcher: Watcher): boolean {
  return issue.assignees.some((login) => isViewer(login, watcher));
}

export function countsFrom(
  repositoryId: string,
  snapshot: RepositorySnapshot,
  watcher: Watcher,
): RepositoryCounts {
  const needYou = snapshot.pullRequests.filter((pullRequest) =>
    needsViewer(pullRequest, watcher),
  ).length;
  const assigned = snapshot.issues.filter((issue) =>
    isAssignedTo(issue, watcher),
  ).length;

  return {
    repositoryId,
    openPullRequests: snapshot.openPullRequests,
    openIssues: snapshot.openIssues,
    pullRequestHint:
      snapshot.openPullRequests === 0
        ? "nothing open"
        : needYou === 0
          ? "none need you"
          : `${needYou} ${needYou === 1 ? "needs" : "need"} you`,
    issueHint:
      snapshot.openIssues === 0
        ? "nothing open"
        : assigned === 0
          ? "none assigned"
          : `${assigned} assigned`,
    lastActivityAt: snapshot.lastActivityAt,
  };
}

/**
 * What needs the viewer comes first — their review, then their own pull
 * requests that are blocked — then everything else, most recently touched
 * first.
 */
function attention(pullRequest: PullRequestRecord, watcher: Watcher): number {
  const state = reviewStateFor(pullRequest, watcher);
  if (state === "your-review") return 0;
  if (
    isViewer(pullRequest.author, watcher) &&
    (state === "changes-requested" || pullRequest.checkRollup === "failed")
  ) {
    return 1;
  }
  if (pullRequest.checkRollup === "failed") return 2;
  return 3;
}

export function openPullRequestsFrom(
  snapshot: RepositorySnapshot,
  watcher: Watcher,
): OpenPullRequests {
  const all = snapshot.pullRequests;
  const yourReview = all.filter((pr) => needsViewer(pr, watcher)).length;
  const failing = all.filter((pr) => pr.checkRollup === "failed").length;
  const readyToMerge = all.filter(
    (pr) =>
      reviewStateFor(pr, watcher) === "approved" &&
      pr.checkRollup !== "failed" &&
      pr.checkRollup !== "running",
  ).length;

  const parts: string[] = [];
  if (yourReview > 0) parts.push(`${yourReview} waiting on your review`);
  if (failing > 0) parts.push(`${failing} with failing checks`);
  const summary =
    parts.length > 0
      ? parts.join(", ")
      : snapshot.openPullRequests === 0
        ? "nothing open"
        : readyToMerge > 0
          ? `${readyToMerge} approved and green`
          : "nothing waiting on you";

  const shown = [...all]
    .sort(
      (one, other) =>
        attention(one, watcher) - attention(other, watcher) ||
        other.updatedAt.getTime() - one.updatedAt.getTime(),
    )
    .slice(0, PANEL_LIMIT)
    .map((pullRequest): PullRequestSummary => {
      const reviewState = reviewStateFor(pullRequest, watcher);
      return {
        number: pullRequest.number,
        title: pullRequest.title,
        author: whoIs(pullRequest.author, watcher),
        openedAt: pullRequest.openedAt,
        reviewState,
        reviewLabel: reviewLabelFor(pullRequest, reviewState),
        checkRollup: pullRequest.checkRollup,
        checkSummary: checkSummaryFor(pullRequest),
      };
    });

  return { summary, totalOpen: snapshot.openPullRequests, shown };
}

export function openIssuesFrom(
  snapshot: RepositorySnapshot,
  watcher: Watcher,
): OpenIssues {
  const all = snapshot.issues;
  const assigned = all.filter((issue) => isAssignedTo(issue, watcher)).length;
  const unlabelled = all.filter((issue) => issue.labels.length === 0).length;

  const parts = [
    assigned > 0 ? `${assigned} assigned to you` : "nothing assigned to you",
  ];
  if (unlabelled > 0) parts.push(`${unlabelled} unlabelled`);
  const summary = snapshot.openIssues === 0 ? "nothing open" : parts.join(", ");

  const shown = [...all]
    .sort(
      (one, other) =>
        Number(isAssignedTo(other, watcher)) -
          Number(isAssignedTo(one, watcher)) ||
        other.updatedAt.getTime() - one.updatedAt.getTime(),
    )
    .slice(0, PANEL_LIMIT)
    .map((issue): IssueSummary => ({
      number: issue.number,
      title: issue.title,
      label: issue.labels[0] ?? null,
      openedAt: issue.openedAt,
      assignee:
        issue.assignees.length === 0
          ? null
          : whoIs(
              issue.assignees.find((login) => isViewer(login, watcher)) ??
                issue.assignees[0]!,
              watcher,
            ),
    }));

  return { summary, totalOpen: snapshot.openIssues, shown };
}

/** "41 s", "1 m 12 s" — how the prototype writes a check's duration. */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} m ${String(rest).padStart(2, "0")} s`;
}

function durationOf(check: CheckRecord, now: Date): string | null {
  if (!check.startedAt) return null;
  const end =
    check.completedAt ?? (check.conclusion === "running" ? now : null);
  if (!end) return null;
  return formatDuration(end.getTime() - check.startedAt.getTime());
}

function names(logins: readonly string[], watcher: Watcher): string {
  const people = logins.map((login) => whoIs(login, watcher));
  if (people.length <= 2) return people.join(" and ");
  return `${people.slice(0, -1).join(", ")} and ${people.at(-1)}`;
}

function capitalise(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** One or two plain sentences saying what stands between this and a merge. */
export function blockingReasonFor(
  pullRequest: PullRequestRecord,
  watcher: Watcher,
): string {
  const failed = pullRequest.checks
    .filter((check) => check.conclusion === "failed")
    .map((check) => check.name);
  const checks = checksSentence(pullRequest.checkRollup, failed);

  const state = reviewStateFor(pullRequest, watcher);
  let review: string;
  switch (state) {
    case "draft":
      review = "Draft.";
      break;
    case "your-review":
      review = "Waiting on your review.";
      break;
    case "changes-requested":
      review = `${capitalise(names(pullRequest.changesRequestedBy.length > 0 ? pullRequest.changesRequestedBy : ["a reviewer"], watcher))} requested changes.`;
      break;
    case "approved":
      if (
        pullRequest.checkRollup === "passed" ||
        pullRequest.checkRollup === "none"
      ) {
        return pullRequest.approvedBy.length > 0
          ? `Approved by ${names(pullRequest.approvedBy, watcher)}. Nothing is blocking the merge.`
          : "Approved. Nothing is blocking the merge.";
      }
      review = `Approved by ${names(pullRequest.approvedBy.length > 0 ? pullRequest.approvedBy : ["a reviewer"], watcher)}.`;
      break;
    case "none":
      review =
        pullRequest.requestedReviewers.length > 0
          ? `Waiting on ${names(pullRequest.requestedReviewers, watcher)} to review.`
          : "Nobody has been asked to review it.";
      break;
  }
  return checks ? `${review} ${checks}` : review;
}

function checksSentence(
  rollup: CheckRollup,
  failed: readonly string[],
): string | null {
  switch (rollup) {
    case "failed":
      return failed.length === 0
        ? "Checks are failing on the latest push."
        : `${failed.length === 1 ? `The ${failed[0]} check is` : `${failed.slice(0, 3).join(", ")} are`} failing on the latest push.`;
    case "running":
      return "Checks are still running on the latest push.";
    default:
      return null;
  }
}

export function pullRequestChecksFrom(
  pullRequest: PullRequestRecord,
  watcher: Watcher,
  now: Date,
): PullRequestChecks {
  return {
    headSha: pullRequest.headSha?.slice(0, 7) ?? "",
    checks: pullRequest.checks.map((check) => ({
      name: check.name,
      conclusion: check.conclusion,
      duration: durationOf(check, now),
    })),
    blockingReason: blockingReasonFor(pullRequest, watcher),
  };
}
