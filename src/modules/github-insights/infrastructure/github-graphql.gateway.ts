import { z } from "zod";

import {
  gitHubFailure,
  type GitHubFailure,
  type GitHubGateway,
  type GitHubRepository,
} from "@/modules/github-insights/application/ports/github-gateway";
import type {
  CheckRecord,
  PullRequestRecord,
  RepositorySnapshot,
  ReviewDecision,
} from "@/modules/github-insights/application/ports/repository-snapshot";
import type {
  CheckConclusion,
  CheckRollup,
} from "@/modules/github-insights/application/queries/read-models";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { err, isErr, ok, type Result } from "@/shared/domain";

const ENDPOINT = "https://api.github.com/graphql";
const TIMEOUT_MS = 20_000;

/**
 * How much of a repository one sync copies. The counts are GitHub's totals
 * whatever these are; the lists only feed the panels, which show fewer.
 */
/**
 * How many of the viewer's repositories the picker offers. Five pages cover
 * most people; whoever has more finds the recently pushed ones first.
 */
export const REPOSITORY_LIST_LIMITS = { perPage: 100, pages: 5 } as const;

export const SNAPSHOT_LIMITS = {
  pullRequests: 50,
  issues: 50,
  checksPerPullRequest: 50,
  reviewers: 20,
} as const;

/**
 * One query per repository covers everything the table and its panels show:
 * both totals, each open pull request with its reviews and the checks on its
 * head commit, and the open issues. GraphQL's `issues` excludes pull requests,
 * unlike REST's, so the issue count is not inflated.
 *
 * No field of `Team` is selected: GitHub checks scopes against the query text,
 * and any Team field needs `read:org`, which the sign-in does not ask for. With
 * one in the query every sync is refused, team review request or not.
 */
const SNAPSHOT_QUERY = /* GraphQL */ `
  query RepositorySnapshot($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pushedAt
      pullRequests(
        states: OPEN
        first: ${SNAPSHOT_LIMITS.pullRequests}
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          number
          title
          isDraft
          createdAt
          updatedAt
          author { login }
          reviewDecision
          reviewRequests(first: ${SNAPSHOT_LIMITS.reviewers}) {
            nodes {
              requestedReviewer {
                __typename
                ... on User { login }
                ... on Bot { login }
                ... on Mannequin { login }
              }
            }
          }
          latestOpinionatedReviews(first: ${SNAPSHOT_LIMITS.reviewers}) {
            nodes { state author { login } }
          }
          commits(last: 1) {
            nodes {
              commit {
                oid
                statusCheckRollup {
                  state
                  contexts(first: ${SNAPSHOT_LIMITS.checksPerPullRequest}) {
                    nodes {
                      __typename
                      ... on CheckRun { name status conclusion startedAt completedAt }
                      ... on StatusContext { context state createdAt }
                    }
                  }
                }
              }
            }
          }
        }
      }
      issues(
        states: OPEN
        first: ${SNAPSHOT_LIMITS.issues}
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          number
          title
          createdAt
          updatedAt
          labels(first: 5) { nodes { name } }
          assignees(first: 5) { nodes { login } }
        }
      }
    }
  }
`;

/** Most recently pushed first, which is the order people look for them in. */
const LIST_QUERY = /* GraphQL */ `
  query ViewerRepositories($after: String) {
    viewer {
      repositories(
        first: ${REPOSITORY_LIST_LIMITS.perPage}
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        isArchived: false
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes { nameWithOwner isPrivate description pushedAt }
      }
    }
  }
`;

// Enums are read as plain strings: GitHub adds values from time to time, and
// a new one should read as "unknown", not fail the whole sync.
const login = z.object({ login: z.string() }).nullable();
const date = z.string().transform((value) => new Date(value));
const nullableDate = date.nullable();

const checkContext = z.discriminatedUnion("__typename", [
  z.object({
    __typename: z.literal("CheckRun"),
    name: z.string(),
    status: z.string(),
    conclusion: z.string().nullable(),
    startedAt: nullableDate,
    completedAt: nullableDate,
  }),
  z.object({
    __typename: z.literal("StatusContext"),
    context: z.string(),
    state: z.string(),
    createdAt: date,
  }),
]);

const pullRequestNode = z.object({
  number: z.number(),
  title: z.string(),
  isDraft: z.boolean(),
  createdAt: date,
  updatedAt: date,
  author: login,
  reviewDecision: z.string().nullable(),
  reviewRequests: z.object({
    nodes: z.array(
      z
        .object({
          requestedReviewer: z
            .object({
              __typename: z.string(),
              login: z.string().optional(),
            })
            .nullable(),
        })
        .nullable(),
    ),
  }),
  latestOpinionatedReviews: z.object({
    nodes: z.array(z.object({ state: z.string(), author: login }).nullable()),
  }),
  commits: z.object({
    nodes: z.array(
      z
        .object({
          commit: z.object({
            oid: z.string(),
            statusCheckRollup: z
              .object({
                state: z.string(),
                contexts: z.object({
                  nodes: z.array(checkContext.nullable()),
                }),
              })
              .nullable(),
          }),
        })
        .nullable(),
    ),
  }),
});

const issueNode = z.object({
  number: z.number(),
  title: z.string(),
  createdAt: date,
  updatedAt: date,
  labels: z
    .object({ nodes: z.array(z.object({ name: z.string() }).nullable()) })
    .nullable(),
  assignees: z.object({ nodes: z.array(login) }),
});

const snapshotData = z.object({
  repository: z
    .object({
      pushedAt: nullableDate,
      pullRequests: z.object({
        totalCount: z.number(),
        nodes: z.array(pullRequestNode.nullable()),
      }),
      issues: z.object({
        totalCount: z.number(),
        nodes: z.array(issueNode.nullable()),
      }),
    })
    .nullable(),
});

const listData = z.object({
  viewer: z.object({
    repositories: z.object({
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullable(),
      }),
      nodes: z.array(
        z
          .object({
            nameWithOwner: z.string(),
            isPrivate: z.boolean(),
            description: z.string().nullable(),
            pushedAt: nullableDate,
          })
          .nullable(),
      ),
    }),
  }),
});

type ListData = z.infer<typeof listData>;

const graphQlResponse = z.object({
  data: z.unknown().optional(),
  errors: z
    .array(z.object({ type: z.string().optional(), message: z.string() }))
    .optional(),
});

type Fetch = typeof fetch;

/**
 * GitHub's GraphQL API, read with one viewer's OAuth token. The token is bound
 * here by the composition root and never leaves this class.
 */
export class GitHubGraphqlGateway implements GitHubGateway {
  constructor(
    private readonly accessToken: string | null,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async listRepositories(): Promise<
    Result<readonly GitHubRepository[], GitHubFailure>
  > {
    const found: GitHubRepository[] = [];
    let after: string | null = null;

    for (let page = 0; page < REPOSITORY_LIST_LIMITS.pages; page++) {
      const response: Result<ListData, GitHubFailure> = await this.#query(
        LIST_QUERY,
        { after },
        listData,
      );
      if (isErr(response)) return response;

      const { nodes, pageInfo }: ListData["viewer"]["repositories"] =
        response.value.viewer.repositories;
      for (const node of nodes) {
        if (!node) continue;
        const coordinates = RepositoryCoordinates.parse(node.nameWithOwner);
        if (isErr(coordinates)) continue;
        found.push({
          owner: coordinates.value.owner,
          name: coordinates.value.name,
          isPrivate: node.isPrivate,
          description: node.description,
          pushedAt: node.pushedAt,
        });
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }
    return ok(found);
  }

  async fetchSnapshot(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubFailure>> {
    const response = await this.#query(
      SNAPSHOT_QUERY,
      { owner: coordinates.owner, name: coordinates.name },
      snapshotData,
    );
    if (isErr(response)) return response;

    const repository = response.value.repository;
    if (!repository) return err(notFound(coordinates));

    const pullRequests = repository.pullRequests.nodes
      .filter((node) => node !== null)
      .map(toPullRequestRecord);
    const issues = repository.issues.nodes
      .filter((node) => node !== null)
      .map((node) => ({
        number: node.number,
        title: node.title,
        labels: (node.labels?.nodes ?? []).flatMap((label) =>
          label ? [label.name] : [],
        ),
        assignees: node.assignees.nodes.flatMap((one) =>
          one ? [one.login] : [],
        ),
        openedAt: node.createdAt,
        updatedAt: node.updatedAt,
      }));

    return ok({
      openPullRequests: repository.pullRequests.totalCount,
      openIssues: repository.issues.totalCount,
      lastActivityAt: latest([
        repository.pushedAt,
        ...pullRequests.map((one) => one.updatedAt),
        ...issues.map((one) => one.updatedAt),
      ]),
      pullRequests,
      issues,
    });
  }

  async #query<T>(
    query: string,
    variables: Record<string, string | null>,
    schema: z.ZodType<T>,
  ): Promise<Result<T, GitHubFailure>> {
    if (!this.accessToken) {
      return err(
        gitHubFailure(
          "github-unauthorized",
          "Sign in with GitHub again to read your repositories.",
        ),
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          "content-type": "application/json",
          "user-agent": "fenro-dashboard",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      return err(logged(unavailable("GitHub did not answer."), error));
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    const failure = failureFromStatus(response, body);
    if (failure) return err(logged(failure));

    const parsed = graphQlResponse.safeParse(body);
    if (!parsed.success) {
      return err(
        logged(unavailable("GitHub sent an answer this app cannot read.")),
      );
    }

    // A missing repository comes back as `repository: null` beside a
    // NOT_FOUND error; the callers turn the null into the failure.
    const errors = (parsed.data.errors ?? []).filter(
      (error) => error.type !== "NOT_FOUND",
    );
    if (errors.length > 0) return err(logged(failureFromErrors(errors)));
    if (parsed.data.data === undefined) {
      return err(logged(unavailable("GitHub sent no data.")));
    }

    const data = schema.safeParse(parsed.data.data);
    if (!data.success) {
      return err(
        logged(
          unavailable("GitHub sent an answer this app cannot read."),
          z.prettifyError(data.error),
        ),
      );
    }
    return ok(data.data);
  }
}

type GraphQlError = { readonly type?: string; readonly message: string };

/**
 * GitHub's own words go on the row, so a person can act on them — an
 * organization that has to approve the app says so in its message.
 */
function failureFromErrors(errors: readonly GraphQlError[]): GitHubFailure {
  const said = gitHubSaid(errors[0]?.message);
  if (errors.some((error) => error.type === "RATE_LIMITED")) {
    return rateLimited();
  }
  if (errors.some((error) => error.type === "INSUFFICIENT_SCOPES")) {
    return gitHubFailure(
      "github-unauthorized",
      `GitHub says this sign-in is missing a permission. Sign out and in again. ${said}`,
    );
  }
  if (errors.some((error) => error.type === "FORBIDDEN")) {
    return gitHubFailure("github-forbidden", `GitHub refused access. ${said}`);
  }
  return unavailable(`GitHub refused the request. ${said}`);
}

function failureFromStatus(
  response: Response,
  body: unknown,
): GitHubFailure | null {
  if (response.ok) return null;
  const said = gitHubSaid(messageOf(body));
  if (response.status === 401) {
    return gitHubFailure(
      "github-unauthorized",
      "GitHub no longer accepts your sign-in. Sign out and in again.",
    );
  }
  if (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  ) {
    return rateLimited();
  }
  if (response.status === 403) {
    return gitHubFailure("github-forbidden", `GitHub refused access. ${said}`);
  }
  return unavailable(`GitHub answered ${response.status}. ${said}`);
}

const MESSAGE_LIMIT = 300;

function gitHubSaid(message: string | undefined): string {
  if (!message) return "";
  const trimmed =
    message.length > MESSAGE_LIMIT
      ? `${message.slice(0, MESSAGE_LIMIT - 1)}…`
      : message;
  return `It said: “${trimmed}”`;
}

function messageOf(body: unknown): string | undefined {
  const parsed = z.object({ message: z.string() }).safeParse(body);
  return parsed.success ? parsed.data.message : undefined;
}

/**
 * The row shows the failure; the server log keeps it too, with the detail a
 * person does not need, so it can be diagnosed without reproducing it.
 */
function logged(failure: GitHubFailure, detail?: unknown): GitHubFailure {
  console.warn(`[github] ${failure.code}: ${failure.message}`, detail ?? "");
  return failure;
}

function unavailable(reason: string): GitHubFailure {
  return gitHubFailure("github-unavailable", reason.trim());
}

function rateLimited(): GitHubFailure {
  return gitHubFailure(
    "github-rate-limited",
    "GitHub's rate limit is used up for now. Try again later.",
  );
}

function notFound(coordinates: RepositoryCoordinates): GitHubFailure {
  return gitHubFailure(
    "github-not-found",
    `GitHub has no repository ${coordinates.fullName} that you can see.`,
  );
}

function latest(dates: readonly (Date | null)[]): Date | null {
  const times = dates.flatMap((date) => (date ? [date.getTime()] : []));
  return times.length === 0 ? null : new Date(Math.max(...times));
}

type PullRequestNode = z.infer<typeof pullRequestNode>;
type CheckContext = z.infer<typeof checkContext>;

function toPullRequestRecord(node: PullRequestNode): PullRequestRecord {
  const reviews = node.latestOpinionatedReviews.nodes.filter(
    (review) => review !== null,
  );
  const reviewersIn = (state: string) =>
    reviews.flatMap((review) =>
      review.state === state && review.author ? [review.author.login] : [],
    );
  const commit = node.commits.nodes.at(-1)?.commit ?? null;
  const rollup = commit?.statusCheckRollup ?? null;

  return {
    number: node.number,
    title: node.title,
    author: node.author?.login ?? null,
    isDraft: node.isDraft,
    openedAt: node.createdAt,
    updatedAt: node.updatedAt,
    reviewDecision: toReviewDecision(node.reviewDecision),
    requestedReviewers: node.reviewRequests.nodes.flatMap((request) => {
      const reviewer = request?.requestedReviewer;
      return reviewer?.login ? [reviewer.login] : [];
    }),
    approvedBy: reviewersIn("APPROVED"),
    changesRequestedBy: reviewersIn("CHANGES_REQUESTED"),
    headSha: commit?.oid ?? null,
    checkRollup: toCheckRollup(rollup?.state ?? null),
    checks: (rollup?.contexts.nodes ?? [])
      .filter((context) => context !== null)
      .map(toCheckRecord),
  };
}

function toReviewDecision(value: string | null): ReviewDecision | null {
  switch (value) {
    case "APPROVED":
      return "approved";
    case "CHANGES_REQUESTED":
      return "changes-requested";
    case "REVIEW_REQUIRED":
      return "review-required";
    default:
      return null;
  }
}

/** GitHub's `StatusState`, the rollup over every check and status. */
function toCheckRollup(state: string | null): CheckRollup {
  switch (state) {
    case "SUCCESS":
      return "passed";
    case "FAILURE":
    case "ERROR":
      return "failed";
    case "PENDING":
    case "EXPECTED":
      return "running";
    default:
      return "none";
  }
}

function toCheckRecord(context: CheckContext): CheckRecord {
  if (context.__typename === "StatusContext") {
    const state = toCheckRollup(context.state);
    return {
      name: context.context,
      conclusion: state === "none" ? "running" : state,
      startedAt: null,
      completedAt: null,
    };
  }
  return {
    name: context.name,
    conclusion: toCheckConclusion(context.status, context.conclusion),
    startedAt: context.startedAt,
    completedAt: context.completedAt,
  };
}

/**
 * A check run is running until it completes. Neutral reads as passed, as it
 * does on GitHub's own merge box; cancelled and timed out read as failed.
 */
function toCheckConclusion(
  status: string,
  conclusion: string | null,
): CheckConclusion {
  if (status !== "COMPLETED") return "running";
  switch (conclusion) {
    case "SUCCESS":
    case "NEUTRAL":
      return "passed";
    case "SKIPPED":
    case "STALE":
      return "skipped";
    default:
      return "failed";
  }
}
