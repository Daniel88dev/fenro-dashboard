import { describe, expect, it, vi } from "vitest";

import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { isErr, unwrap } from "@/shared/domain";

import { GitHubGraphqlGateway } from "./github-graphql.gateway";

const billing = unwrap(RepositoryCoordinates.parse("nordwind/billing-core"));

function respond(body: unknown, init: ResponseInit = {}) {
  return vi.fn(async () =>
    Response.json(body, { status: 200, ...init }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const repository = {
  pushedAt: "2026-09-23T09:00:00Z",
  pullRequests: {
    totalCount: 12,
    nodes: [
      {
        number: 476,
        title: "Multi-currency rounding, take two",
        isDraft: false,
        createdAt: "2026-08-10T09:00:00Z",
        updatedAt: "2026-09-23T10:00:00Z",
        author: { login: "Daniel88dev" },
        reviewDecision: "CHANGES_REQUESTED",
        reviewRequests: {
          nodes: [
            { requestedReviewer: { __typename: "User", login: "mira" } },
            {
              requestedReviewer: {
                __typename: "Team",
                combinedSlug: "nordwind/payments",
              },
            },
          ],
        },
        latestOpinionatedReviews: {
          nodes: [
            { state: "CHANGES_REQUESTED", author: { login: "tom" } },
            { state: "APPROVED", author: { login: "mira" } },
          ],
        },
        commits: {
          nodes: [
            {
              commit: {
                oid: "3f0b7c1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                statusCheckRollup: {
                  state: "FAILURE",
                  contexts: {
                    nodes: [
                      {
                        __typename: "CheckRun",
                        name: "typecheck",
                        status: "COMPLETED",
                        conclusion: "FAILURE",
                        startedAt: "2026-09-23T09:00:00Z",
                        completedAt: "2026-09-23T09:01:04Z",
                      },
                      {
                        __typename: "CheckRun",
                        name: "integration",
                        status: "IN_PROGRESS",
                        conclusion: null,
                        startedAt: "2026-09-23T09:00:00Z",
                        completedAt: null,
                      },
                      {
                        __typename: "CheckRun",
                        name: "docs",
                        status: "COMPLETED",
                        conclusion: "SKIPPED",
                        startedAt: null,
                        completedAt: null,
                      },
                      {
                        __typename: "StatusContext",
                        context: "ci/legacy",
                        state: "SUCCESS",
                        createdAt: "2026-09-23T09:00:00Z",
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ],
  },
  issues: {
    totalCount: 38,
    nodes: [
      {
        number: 1204,
        title: "Rounding drift on multi-currency refunds",
        createdAt: "2026-09-05T09:00:00Z",
        updatedAt: "2026-09-23T11:00:00Z",
        labels: { nodes: [{ name: "bug" }] },
        assignees: { nodes: [{ login: "Daniel88dev" }] },
      },
    ],
  },
};

describe("GitHubGraphqlGateway", () => {
  it("reads a repository into a snapshot, with the viewer's token", async () => {
    const fetchImpl = respond({ data: { repository } });
    const gateway = new GitHubGraphqlGateway("gho_token", fetchImpl);

    const snapshot = unwrap(await gateway.fetchSnapshot(billing));

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/graphql");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer gho_token",
    );
    expect(JSON.parse(String(init.body)).variables).toEqual({
      owner: "nordwind",
      name: "billing-core",
    });

    expect(snapshot.openPullRequests).toBe(12);
    expect(snapshot.openIssues).toBe(38);
    expect(snapshot.lastActivityAt).toEqual(new Date("2026-09-23T11:00:00Z"));
    expect(snapshot.pullRequests[0]).toMatchObject({
      number: 476,
      author: "Daniel88dev",
      reviewDecision: "changes-requested",
      requestedReviewers: ["mira", "nordwind/payments"],
      approvedBy: ["mira"],
      changesRequestedBy: ["tom"],
      headSha: "3f0b7c1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      checkRollup: "failed",
    });
    expect(
      snapshot.pullRequests[0]?.checks.map((check) => [
        check.name,
        check.conclusion,
      ]),
    ).toEqual([
      ["typecheck", "failed"],
      ["integration", "running"],
      ["docs", "skipped"],
      ["ci/legacy", "passed"],
    ]);
    expect(snapshot.issues[0]).toMatchObject({
      labels: ["bug"],
      assignees: ["Daniel88dev"],
    });
  });

  it("reports a repository the viewer cannot see as not found", async () => {
    const gateway = new GitHubGraphqlGateway(
      "gho_token",
      respond({
        data: { repository: null },
        errors: [{ type: "NOT_FOUND", message: "Could not resolve" }],
      }),
    );

    const result = await gateway.fetchSnapshot(billing);

    expect(isErr(result) && result.error.code).toBe("github-not-found");
  });

  it("returns GitHub's spelling of a repository it found", async () => {
    const gateway = new GitHubGraphqlGateway(
      "gho_token",
      respond({
        data: {
          repository: { name: "Billing-Core", owner: { login: "Nordwind" } },
        },
      }),
    );

    const found = unwrap(await gateway.findRepository(billing));

    expect(found.fullName).toBe("Nordwind/Billing-Core");
  });

  it("tells a spent rate limit apart from GitHub being down", async () => {
    const limited = new GitHubGraphqlGateway(
      "gho_token",
      respond(
        { message: "API rate limit exceeded" },
        { status: 403, headers: { "x-ratelimit-remaining": "0" } },
      ),
    );
    const graphQlLimited = new GitHubGraphqlGateway(
      "gho_token",
      respond({ errors: [{ type: "RATE_LIMITED", message: "limited" }] }),
    );
    const down = new GitHubGraphqlGateway(
      "gho_token",
      respond({ message: "Server Error" }, { status: 502 }),
    );

    const codes = await Promise.all(
      [limited, graphQlLimited, down].map(async (gateway) => {
        const result = await gateway.fetchSnapshot(billing);
        return isErr(result) ? result.error.code : "ok";
      }),
    );

    expect(codes).toEqual([
      "github-rate-limited",
      "github-rate-limited",
      "github-unavailable",
    ]);
  });

  it("asks the viewer to sign in again when GitHub refuses the token", async () => {
    const gateway = new GitHubGraphqlGateway(
      "gho_revoked",
      respond({ message: "Bad credentials" }, { status: 401 }),
    );

    const result = await gateway.fetchSnapshot(billing);

    expect(isErr(result) && result.error.code).toBe("github-unauthorized");
  });

  it("does not call GitHub at all without a token", async () => {
    const fetchImpl = respond({});
    const gateway = new GitHubGraphqlGateway(null, fetchImpl);

    const result = await gateway.fetchSnapshot(billing);

    expect(isErr(result) && result.error.code).toBe("github-unauthorized");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("treats a network failure or a malformed answer as GitHub being unavailable", async () => {
    const offline = new GitHubGraphqlGateway(
      "gho_token",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    );
    const garbled = new GitHubGraphqlGateway(
      "gho_token",
      respond({ data: { repository: { pushedAt: 42 } } }),
    );

    for (const gateway of [offline, garbled]) {
      const result = await gateway.fetchSnapshot(billing);
      expect(isErr(result) && result.error.code).toBe("github-unavailable");
    }
  });
});
