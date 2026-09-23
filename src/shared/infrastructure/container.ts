import {
  SyncWatchedRepositoriesHandler,
  type SyncWatchedRepositoriesCommand,
} from "@/modules/github-insights/application/commands/sync-watched-repositories";
import {
  UnwatchRepositoryHandler,
  type UnwatchRepositoryCommand,
} from "@/modules/github-insights/application/commands/unwatch-repository";
import {
  WatchRepositoryHandler,
  type WatchRepositoryCommand,
} from "@/modules/github-insights/application/commands/watch-repository";
import type { GitHubGateway } from "@/modules/github-insights/application/ports/github-gateway";
import type { RepositorySnapshotStore } from "@/modules/github-insights/application/ports/repository-snapshot";
import {
  DashboardTotalsHandler,
  type DashboardTotalsQuery,
  type DashboardTotalsResult,
} from "@/modules/github-insights/application/queries/dashboard-totals";
import {
  LookUpRepositoryHandler,
  type LookUpRepositoryQuery,
  type LookUpRepositoryResult,
} from "@/modules/github-insights/application/queries/look-up-repository";
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
import { DrizzleRepositorySnapshotStore } from "@/modules/github-insights/infrastructure/drizzle-repository-snapshot.store";
import { DrizzleWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/drizzle-watched-repository.repository";
import { GitHubGraphqlGateway } from "@/modules/github-insights/infrastructure/github-graphql.gateway";
import { SignedInViewerProvider } from "@/modules/github-insights/infrastructure/signed-in-viewer.provider";
import { SnapshotInsightsReader } from "@/modules/github-insights/infrastructure/snapshot-insights.reader";
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
 * It is rebuilt per request rather than shared, because the GitHub adapter is
 * constructed with the signed-in viewer's token (ticket 03), and the watched
 * repository store remembers which version of each aggregate this request
 * loaded. Per docs/research/nextjs-16-rendering-strategy.md it must be built
 * *outside* every `use cache` scope and passed plain arguments in.
 */
export type Container = {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
};

export type ContainerParts = {
  readonly watchedRepositories: WatchedRepositoryRepository;
  readonly snapshots: RepositorySnapshotStore;
  /** Already bound to the viewer's token, or to none when signed out. */
  readonly gitHub: GitHubGateway;
  readonly tasks: TaskReader;
  readonly authenticator: Authenticator;
  readonly clock: () => Date;
};

export function buildContainer(parts: ContainerParts): Container {
  const { watchedRepositories, snapshots, gitHub, clock } = parts;
  const insights = new SnapshotInsightsReader(snapshots, clock);

  const commandBus = new CommandBus();
  commandBus.register<WatchRepositoryCommand>(
    "github-insights.watch-repository",
    new WatchRepositoryHandler(watchedRepositories),
  );
  commandBus.register<UnwatchRepositoryCommand>(
    "github-insights.unwatch-repository",
    new UnwatchRepositoryHandler(watchedRepositories),
  );
  commandBus.register<SyncWatchedRepositoriesCommand>(
    "github-insights.sync-watched-repositories",
    new SyncWatchedRepositoriesHandler(
      watchedRepositories,
      gitHub,
      snapshots,
      clock,
    ),
  );

  const queryBus = new QueryBus();
  queryBus.register<RepositoryRowsQuery, RepositoryRowsResult>(
    "github-insights.repository-rows",
    new RepositoryRowsHandler(watchedRepositories, insights, clock),
  );
  queryBus.register<DashboardTotalsQuery, DashboardTotalsResult>(
    "github-insights.dashboard-totals",
    new DashboardTotalsHandler(watchedRepositories, insights, clock),
  );
  queryBus.register<OpenPullRequestsQuery, OpenPullRequestsResult>(
    "github-insights.open-pull-requests",
    new OpenPullRequestsHandler(watchedRepositories, insights),
  );
  queryBus.register<PullRequestChecksQuery, PullRequestChecksResult>(
    "github-insights.pull-request-checks",
    new PullRequestChecksHandler(watchedRepositories, insights),
  );
  queryBus.register<OpenIssuesQuery, OpenIssuesResult>(
    "github-insights.open-issues",
    new OpenIssuesHandler(watchedRepositories, insights),
  );
  queryBus.register<LookUpRepositoryQuery, LookUpRepositoryResult>(
    "github-insights.look-up-repository",
    new LookUpRepositoryHandler(gitHub),
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

/** Tasks are still a fake: the tasks context gets its own store in slice 6. */
const tasks = new InMemoryTaskReader();

/**
 * Sign-in is Better Auth over Postgres. Both are created on first use, so a
 * build or a test that never signs anybody in needs neither configured.
 */
const auth = () => getAuth(getDatabase);
const authenticator: Authenticator = new BetterAuthAuthenticator(auth);

/** The identity context answers the two questions github-insights asks. */
const viewerProvider = new SignedInViewerProvider({
  user: async () => {
    const user = await authenticator.signedInUser();
    return user ? { id: user.id, login: user.githubLogin } : null;
  },
  accessToken: () => authenticator.gitHubAccessToken(),
});

/**
 * `now` pins the clock for a render, so the relative times on screen and the
 * "is it stale" answers agree. Commands leave it out and get a live clock, so
 * a sync records when it actually finished.
 */
export async function getContainer(now?: Date): Promise<Container> {
  // Who is asking comes first: it reads the request, which is also what keeps
  // `next build` from reaching the database below.
  const viewer = await viewerProvider.current();
  const db = getDatabase();
  return buildContainer({
    watchedRepositories: new DrizzleWatchedRepositoryRepository(db),
    snapshots: new DrizzleRepositorySnapshotStore(db),
    gitHub: new GitHubGraphqlGateway(viewer?.accessToken ?? null),
    tasks,
    authenticator,
    clock: now ? () => now : () => new Date(),
  });
}

export function getAuthenticator(): Authenticator {
  return authenticator;
}

/** Better Auth's own endpoints: the OAuth callback, session and sign-out. */
export function handleAuthRequest(request: Request): Promise<Response> {
  return auth().handler(request);
}
