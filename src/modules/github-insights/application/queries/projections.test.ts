import { describe, expect, it } from "vitest";

import {
  aPullRequest,
  aSnapshot,
  anIssue,
} from "@/modules/github-insights/application/ports/repository-snapshot.fixtures";

import {
  blockingReasonFor,
  countsFrom,
  formatDuration,
  openIssuesFrom,
  openPullRequestsFrom,
  PANEL_LIMIT,
  pullRequestChecksFrom,
  reviewStateFor,
} from "./projections";

const daniel = { id: "user-1", login: "Daniel88dev" };
const now = new Date("2026-09-23T12:00:00Z");

describe("reviewStateFor", () => {
  it("reads a draft as a draft before anything else", () => {
    expect(
      reviewStateFor(
        aPullRequest({ isDraft: true, requestedReviewers: ["Daniel88dev"] }),
        daniel,
      ),
    ).toBe("draft");
  });

  it("puts your requested review ahead of other reviewers' verdicts", () => {
    expect(
      reviewStateFor(
        aPullRequest({
          requestedReviewers: ["daniel88dev"],
          approvedBy: ["mira"],
        }),
        daniel,
      ),
    ).toBe("your-review");
  });

  it("reads GitHub's review decision", () => {
    expect(
      reviewStateFor(
        aPullRequest({ reviewDecision: "changes-requested" }),
        daniel,
      ),
    ).toBe("changes-requested");
    expect(
      reviewStateFor(aPullRequest({ approvedBy: ["tom", "mira"] }), daniel),
    ).toBe("approved");
    expect(reviewStateFor(aPullRequest(), daniel)).toBe("none");
  });
});

describe("countsFrom", () => {
  it("counts what needs the viewer, on top of GitHub's totals", () => {
    const counts = countsFrom(
      "repo-1",
      aSnapshot({
        openPullRequests: 12,
        openIssues: 38,
        pullRequests: [
          aPullRequest({ number: 1, requestedReviewers: ["Daniel88dev"] }),
          aPullRequest({ number: 2, requestedReviewers: ["Daniel88dev"] }),
          aPullRequest({ number: 3, requestedReviewers: ["mira"] }),
        ],
        issues: [
          anIssue({ number: 1, assignees: ["Daniel88dev"] }),
          anIssue({ number: 2, assignees: ["mira"] }),
        ],
      }),
      daniel,
    );

    expect(counts).toMatchObject({
      repositoryId: "repo-1",
      openPullRequests: 12,
      openIssues: 38,
      pullRequestHint: "2 need you",
      issueHint: "1 assigned",
    });
  });

  it("says nothing is open when nothing is", () => {
    expect(countsFrom("repo-1", aSnapshot(), daniel)).toMatchObject({
      pullRequestHint: "nothing open",
      issueHint: "nothing open",
    });
  });
});

describe("openPullRequestsFrom", () => {
  it("lists what waits on you first, and summarises the rest", () => {
    const panel = openPullRequestsFrom(
      aSnapshot({
        openPullRequests: 3,
        pullRequests: [
          aPullRequest({
            number: 1,
            updatedAt: new Date("2026-09-23T11:00:00Z"),
          }),
          aPullRequest({ number: 2, checkRollup: "failed" }),
          aPullRequest({ number: 3, requestedReviewers: ["Daniel88dev"] }),
        ],
      }),
      daniel,
    );

    expect(panel.summary).toBe(
      "1 waiting on your review, 1 with failing checks",
    );
    expect(panel.shown.map((pr) => pr.number)).toEqual([3, 2, 1]);
    expect(panel.shown[0]).toMatchObject({
      reviewState: "your-review",
      reviewLabel: "your review",
    });
  });

  it("names the viewer as you", () => {
    const panel = openPullRequestsFrom(
      aSnapshot({ pullRequests: [aPullRequest({ author: "Daniel88dev" })] }),
      daniel,
    );

    expect(panel.shown[0]?.author).toBe("you");
  });

  it("counts approvals and checks the way the table shows them", () => {
    const panel = openPullRequestsFrom(
      aSnapshot({
        pullRequests: [
          aPullRequest({
            approvedBy: ["tom", "mira"],
            checks: [
              {
                name: "lint",
                conclusion: "passed",
                startedAt: null,
                completedAt: null,
              },
              {
                name: "build",
                conclusion: "passed",
                startedAt: null,
                completedAt: null,
              },
            ],
          }),
        ],
      }),
      daniel,
    );

    expect(panel.summary).toBe("1 approved and green");
    expect(panel.shown[0]).toMatchObject({
      reviewLabel: "2 approvals",
      checkSummary: "2 passed",
    });
  });

  it("shows at most a panel's worth, and keeps GitHub's total", () => {
    const panel = openPullRequestsFrom(
      aSnapshot({
        openPullRequests: 40,
        pullRequests: Array.from({ length: 20 }, (_, index) =>
          aPullRequest({ number: index + 1 }),
        ),
      }),
      daniel,
    );

    expect(panel.shown).toHaveLength(PANEL_LIMIT);
    expect(panel.totalOpen).toBe(40);
  });
});

describe("openIssuesFrom", () => {
  it("puts issues assigned to you first", () => {
    const panel = openIssuesFrom(
      aSnapshot({
        issues: [
          anIssue({ number: 1, labels: ["bug"] }),
          anIssue({ number: 2, assignees: ["mira", "Daniel88dev"] }),
        ],
      }),
      daniel,
    );

    expect(panel.summary).toBe("1 assigned to you, 1 unlabelled");
    expect(panel.shown.map((issue) => issue.number)).toEqual([2, 1]);
    expect(panel.shown[0]?.assignee).toBe("you");
    expect(panel.shown[1]?.label).toBe("bug");
  });

  const issues = [
    anIssue({
      number: 1,
      labels: ["bug"],
      assignees: ["Daniel88dev"],
      openedAt: new Date("2026-09-01T00:00:00Z"),
    }),
    anIssue({
      number: 2,
      assignees: ["mira"],
      openedAt: new Date("2026-08-01T00:00:00Z"),
    }),
    anIssue({
      number: 3,
      assignees: ["Daniel88dev"],
      openedAt: new Date("2026-07-01T00:00:00Z"),
    }),
  ];
  const filter = {
    assignedToMe: false,
    needsTriage: false,
    order: "attention",
  } as const;

  it("narrows to what is assigned to you, or what nobody has labelled", () => {
    const snapshot = aSnapshot({ issues });

    const assigned = openIssuesFrom(snapshot, daniel, {
      ...filter,
      assignedToMe: true,
    });
    const triage = openIssuesFrom(snapshot, daniel, {
      ...filter,
      needsTriage: true,
    });
    const both = openIssuesFrom(snapshot, daniel, {
      ...filter,
      assignedToMe: true,
      needsTriage: true,
    });

    expect(assigned.shown.map((issue) => issue.number).sort()).toEqual([1, 3]);
    expect(triage.shown.map((issue) => issue.number).sort()).toEqual([2, 3]);
    expect(both.shown.map((issue) => issue.number)).toEqual([3]);
    expect(both.matching).toBe(1);
  });

  it("keeps the summary about every open issue while a chip is pressed", () => {
    const panel = openIssuesFrom(aSnapshot({ issues }), daniel, {
      ...filter,
      needsTriage: true,
    });

    expect(panel.summary).toBe("2 assigned to you, 2 unlabelled");
  });

  it("lists the oldest first when asked, whoever it is assigned to", () => {
    const panel = openIssuesFrom(aSnapshot({ issues }), daniel, {
      ...filter,
      order: "oldest",
    });

    expect(panel.shown.map((issue) => issue.number)).toEqual([3, 2, 1]);
  });

  it("says whether the stored issues are all of them", () => {
    expect(openIssuesFrom(aSnapshot({ issues }), daniel).complete).toBe(true);

    const partial = openIssuesFrom(
      aSnapshot({ issues, openIssues: 312 }),
      daniel,
    );
    expect(partial.complete).toBe(false);
    expect(partial.stored).toBe(3);
  });
});

describe("blockingReasonFor", () => {
  it("says who asked for changes and which checks fail", () => {
    expect(
      blockingReasonFor(
        aPullRequest({
          changesRequestedBy: ["tom"],
          checkRollup: "failed",
          checks: [
            {
              name: "typecheck",
              conclusion: "failed",
              startedAt: null,
              completedAt: null,
            },
          ],
        }),
        daniel,
      ),
    ).toBe(
      "Tom requested changes. The typecheck check is failing on the latest push.",
    );
  });

  it("says when nothing blocks the merge", () => {
    expect(
      blockingReasonFor(aPullRequest({ approvedBy: ["tom", "mira"] }), daniel),
    ).toBe("Approved by tom and mira. Nothing is blocking the merge.");
  });

  it("says nobody was asked to review", () => {
    expect(blockingReasonFor(aPullRequest(), daniel)).toBe(
      "Nobody has been asked to review it.",
    );
  });
});

describe("pullRequestChecksFrom", () => {
  it("shortens the sha and times each check", () => {
    const checks = pullRequestChecksFrom(
      aPullRequest({
        checks: [
          {
            name: "unit tests",
            conclusion: "passed",
            startedAt: new Date("2026-09-23T11:00:00Z"),
            completedAt: new Date("2026-09-23T11:02:48Z"),
          },
          {
            name: "integration",
            conclusion: "running",
            startedAt: new Date("2026-09-23T11:59:19Z"),
            completedAt: null,
          },
          {
            name: "status",
            conclusion: "passed",
            startedAt: null,
            completedAt: null,
          },
        ],
      }),
      daniel,
      now,
    );

    expect(checks.headSha).toBe("a91c4de");
    expect(checks.checks.map((check) => check.duration)).toEqual([
      "2 m 48 s",
      "41 s",
      null,
    ]);
  });
});

describe("formatDuration", () => {
  it("writes seconds, then minutes and seconds", () => {
    expect(formatDuration(41_000)).toBe("41 s");
    expect(formatDuration(72_000)).toBe("1 m 12 s");
    expect(formatDuration(362_000)).toBe("6 m 02 s");
  });
});
