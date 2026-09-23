import { beforeEach, describe, expect, it, vi } from "vitest";

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
            { requestedReviewer: { __typename: "Team" } },
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

function queryOf(fetchImpl: ReturnType<typeof respond>, call = 0) {
  const [, init] = fetchImpl.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as {
    query: string;
    variables: Record<string, unknown>;
  };
}

describe("GitHubGraphqlGateway", () => {
  beforeEach(() => {
    // Every failure is logged for the server's operator; not for the test run.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

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
      requestedReviewers: ["mira"],
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

  it("asks for nothing that needs a scope sign-in does not request", async () => {
    // Any Team field needs read:org, and GitHub refuses the whole query for it.
    const fetchImpl = respond({ data: { repository } });

    await new GitHubGraphqlGateway("gho_token", fetchImpl).fetchSnapshot(
      billing,
    );

    expect(queryOf(fetchImpl).query).not.toMatch(/on Team/);
  });

  it("lists the viewer's repositories page by page, as GitHub spells them", async () => {
    const page = (
      names: string[],
      endCursor: string | null,
      hasNextPage: boolean,
    ) => ({
      data: {
        viewer: {
          repositories: {
            pageInfo: { hasNextPage, endCursor },
            nodes: names.map((nameWithOwner) => ({
              nameWithOwner,
              isPrivate: true,
              description: null,
              pushedAt: "2026-09-23T09:00:00Z",
            })),
          },
        },
      },
    });
    const answers = [
      page(["Nordwind/Billing-Core"], "cursor-1", true),
      page(["Daniel88dev/fenro-dashboard"], null, false),
    ];
    const fetchImpl = vi.fn(async () =>
      Response.json(answers.shift()),
    ) as unknown as ReturnType<typeof respond>;

    const listed = unwrap(
      await new GitHubGraphqlGateway("gho_token", fetchImpl).listRepositories(),
    );

    expect(listed.map((one) => `${one.owner}/${one.name}`)).toEqual([
      "Nordwind/Billing-Core",
      "Daniel88dev/fenro-dashboard",
    ]);
    expect(listed[0]).toMatchObject({
      isPrivate: true,
      pushedAt: new Date("2026-09-23T09:00:00Z"),
    });
    expect(queryOf(fetchImpl, 1).variables).toEqual({ after: "cursor-1" });
    // Organization repositories are left out unless asked for by owner too.
    expect(queryOf(fetchImpl).query).toMatch(
      /ownerAffiliations: \[OWNER, COLLABORATOR, ORGANIZATION_MEMBER\]/,
    );
  });

  it("passes on what GitHub said when it refuses a query", async () => {
    const scopes = new GitHubGraphqlGateway(
      "gho_token",
      respond({
        errors: [
          {
            type: "INSUFFICIENT_SCOPES",
            message: "Your token has not been granted the required scopes.",
          },
        ],
      }),
    );
    const restricted = new GitHubGraphqlGateway(
      "gho_token",
      respond({
        data: { repository: null },
        errors: [
          {
            type: "FORBIDDEN",
            message:
              "The nordwind organization has enabled OAuth App access restrictions.",
          },
        ],
      }),
    );

    const [missingScope, forbidden] = await Promise.all([
      scopes.fetchSnapshot(billing),
      restricted.fetchSnapshot(billing),
    ]);

    expect(isErr(missingScope) && missingScope.error).toMatchObject({
      code: "github-unauthorized",
      message: expect.stringContaining("has not been granted"),
    });
    expect(isErr(forbidden) && forbidden.error).toMatchObject({
      code: "github-forbidden",
      message: expect.stringContaining("OAuth App access restrictions"),
    });
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
