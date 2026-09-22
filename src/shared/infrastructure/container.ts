import {
  UnwatchRepositoryHandler,
  type UnwatchRepositoryCommand,
} from "@/modules/github-insights/application/commands/unwatch-repository";
import {
  WatchRepositoryHandler,
  type WatchRepositoryCommand,
} from "@/modules/github-insights/application/commands/watch-repository";
import type { Viewer } from "@/modules/github-insights/application/ports/viewer";
import {
  DashboardTotalsHandler,
  type DashboardTotalsQuery,
  type DashboardTotalsResult,
} from "@/modules/github-insights/application/queries/dashboard-totals";
import {
  OpenIssuesHandler,
  type OpenIssuesQuery,
  type OpenIssuesResult,
} from "@/modules/github-insights/application/queries/open-issues";
import {
  OpenPullRequestsHandler,
  type OpenPullRequestsQuery,
  type OpenPullRequestsResult,
} from "@/modules/github-insights/application/queries/open-pull-requests";
import {
  PullRequestChecksHandler,
  type PullRequestChecksQuery,
  type PullRequestChecksResult,
} from "@/modules/github-insights/application/queries/pull-request-checks";
import {
  RepositoryRowsHandler,
  type RepositoryRowsQuery,
  type RepositoryRowsResult,
} from "@/modules/github-insights/application/queries/repository-rows";
import type { WatchedRepositoryRepository } from "@/modules/github-insights/domain";
import { InMemoryRepositoryInsightsReader } from "@/modules/github-insights/infrastructure/in-memory-repository-insights.reader";
import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import { sampleWatchedRepositories } from "@/modules/github-insights/infrastructure/sample-watched-repositories";
import { SignedInViewerProvider } from "@/modules/github-insights/infrastructure/signed-in-viewer.provider";
import type {
  Authenticator,
  SignedInUser,
} from "@/modules/identity/application/ports/authenticator";
import {
  SignedInUserHandler,
  type SignedInUserQuery,
} from "@/modules/identity/application/queries/signed-in-user";
import { getAuth } from "@/modules/identity/infrastructure/better-auth";
import { BetterAuthAuthenticator } from "@/modules/identity/infrastructure/better-auth.authenticator";
import type { TaskReader } from "@/modules/tasks/application/ports/task-reader";
import type { TaskCountsByRepository } from "@/modules/tasks/application/queries/read-models";
import {
  TaskCountsByRepositoryHandler,
  type TaskCountsByRepositoryQuery,
} from "@/modules/tasks/application/queries/task-counts-by-repository";
import {
  TasksForRepositoryHandler,
  type TasksForRepositoryQuery,
} from "@/modules/tasks/application/queries/tasks-for-repository";
import type { RepositoryTasks } from "@/modules/tasks/application/queries/read-models";
import { InMemoryTaskReader } from "@/modules/tasks/infrastructure/in-memory-task.reader";
import { CommandBus, QueryBus } from "@/shared/application";
import { getDatabase } from "@/shared/infrastructure/database/client";

/**
 * The composition root: the one place allowed to know every module, so nothing
 * else has to.
 *
 * It is rebuilt per request rather than shared, because the adapters are
 * constructed with the signed-in viewer's GitHub credentials (ticket 03). The stores it wires stay process-wide, so what you watch
 * survives the request that watched it. Per
 * docs/research/nextjs-16-rendering-strategy.md this must be built *outside*
 * every `use cache` scope and passed plain arguments in.
 */
export type Container = {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
};

export type ContainerParts = {
  readonly watchedRepositories: WatchedRepositoryRepository;
  readonly tasks: TaskReader;
  readonly authenticator: Authenticator;
  readonly viewer: Viewer | null;
  /**
   * One instant for the whole request. The sample data holds ages as offsets,
   * so a second `new Date()` in the renderer would round them down by a day.
   */
  readonly now: Date;
};

export function buildContainer(parts: ContainerParts): Container {
  const insights = new InMemoryRepositoryInsightsReader(
    parts.viewer,
    undefined,
    () => parts.now,
  );

  const commandBus = new CommandBus();
  commandBus.register<WatchRepositoryCommand>(
    "github-insights.watch-repository",
    new WatchRepositoryHandler(parts.watchedRepositories),
  );
  commandBus.register<UnwatchRepositoryCommand>(
    "github-insights.unwatch-repository",
    new UnwatchRepositoryHandler(parts.watchedRepositories),
  );

  const queryBus = new QueryBus();
  queryBus.register<RepositoryRowsQuery, RepositoryRowsResult>(
    "github-insights.repository-rows",
    new RepositoryRowsHandler(parts.watchedRepositories, insights),
  );
  queryBus.register<DashboardTotalsQuery, DashboardTotalsResult>(
    "github-insights.dashboard-totals",
    new DashboardTotalsHandler(parts.watchedRepositories, insights),
  );
  queryBus.register<OpenPullRequestsQuery, OpenPullRequestsResult>(
    "github-insights.open-pull-requests",
    new OpenPullRequestsHandler(insights),
  );
  queryBus.register<PullRequestChecksQuery, PullRequestChecksResult>(
    "github-insights.pull-request-checks",
    new PullRequestChecksHandler(insights),
  );
  queryBus.register<OpenIssuesQuery, OpenIssuesResult>(
    "github-insights.open-issues",
    new OpenIssuesHandler(insights),
  );
  queryBus.register<SignedInUserQuery, SignedInUser | null>(
    "identity.signed-in-user",
    new SignedInUserHandler(parts.authenticator),
  );
  queryBus.register<TaskCountsByRepositoryQuery, TaskCountsByRepository>(
    "tasks.task-counts-by-repository",
    new TaskCountsByRepositoryHandler(parts.tasks),
  );
  queryBus.register<TasksForRepositoryQuery, RepositoryTasks>(
    "tasks.tasks-for-repository",
    new TasksForRepositoryHandler(parts.tasks),
  );

  return { commandBus, queryBus };
}

/**
 * Process-wide state, so watching a repository outlives the request. These are
 * fakes: real persistence is ticket 07's to choose, and until it lands a fresh
 * process starts from the sample data again.
 */
const watchedRepositories = new InMemoryWatchedRepositoryRepository(
  sampleWatchedRepositories(),
);
const tasks = new InMemoryTaskReader();

/**
 * Sign-in is Better Auth over Postgres. Both are created on first use, so a
 * build or a test that never signs anybody in needs neither configured.
 */
const auth = () => getAuth(getDatabase);
const authenticator: Authenticator = new BetterAuthAuthenticator(auth);

/** The identity context answers the two questions github-insights asks. */
const viewerProvider = new SignedInViewerProvider({
  login: async () => (await authenticator.signedInUser())?.githubLogin ?? null,
  accessToken: () => authenticator.gitHubAccessToken(),
});

export async function getContainer(now: Date = new Date()): Promise<Container> {
  return buildContainer({
    watchedRepositories,
    tasks,
    authenticator,
    viewer: await viewerProvider.current(),
    now,
  });
}

/**
 * Sign-in and sign-out are steps in GitHub's OAuth protocol, not changes to
 * anything this app models, so the server actions that run them talk to the
 * port directly rather than through the command bus.
 */
export function getAuthenticator(): Authenticator {
  return authenticator;
}

/** Better Auth's own endpoints: the OAuth callback, session and sign-out. */
export function handleAuthRequest(request: Request): Promise<Response> {
  return auth().handler(request);
}
