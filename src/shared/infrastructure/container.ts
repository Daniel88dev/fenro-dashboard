import {
  PinRepositoryHandler,
  UnpinRepositoryHandler,
  type PinRepositoryCommand,
  type UnpinRepositoryCommand,
} from "@/modules/github-insights/application/commands/pin-repository";
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
import {
  WatchableRepositoriesHandler,
  type WatchableRepositoriesQuery,
  type WatchableRepositoriesResult,
} from "@/modules/github-insights/application/queries/watchable-repositories";
import {
  WatchedRepositoryNamesHandler,
  type WatchedRepositoryName,
  type WatchedRepositoryNamesQuery,
} from "@/modules/github-insights/application/queries/watched-repository-names";
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
import {
  IssueAccessTokenHandler,
  type IssueAccessTokenCommand,
} from "@/modules/identity/application/commands/issue-access-token";
import {
  RecordAccessTokenUseHandler,
  type RecordAccessTokenUseCommand,
} from "@/modules/identity/application/commands/record-access-token-use";
import {
  RevokeAccessTokenHandler,
  type RevokeAccessTokenCommand,
} from "@/modules/identity/application/commands/revoke-access-token";
import {
  AccessTokensHandler,
  type AccessTokensQuery,
  type AccessTokenSummary,
} from "@/modules/identity/application/queries/access-tokens";
import {
  AuthenticateAgentHandler,
  type AuthenticateAgentQuery,
  type AuthenticateAgentResult,
} from "@/modules/identity/application/queries/authenticate-agent";
import type { AccessTokenRepository } from "@/modules/identity/domain";
import { DrizzleAccessTokenRepository } from "@/modules/identity/infrastructure/drizzle-access-token.repository";
import {
  ChangeStatusHandler,
  type ChangeStatusCommand,
} from "@/modules/tasks/application/commands/change-status";
import {
  CheckCriterionHandler,
  type CheckCriterionCommand,
} from "@/modules/tasks/application/commands/check-criterion";
import {
  CreateLabelHandler,
  type CreateLabelCommand,
} from "@/modules/tasks/application/commands/create-label";
import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "@/modules/tasks/application/commands/create-task";
import {
  FinishSessionHandler,
  type FinishSessionCommand,
} from "@/modules/tasks/application/commands/finish-session";
import {
  LinkTasksHandler,
  type LinkTasksCommand,
} from "@/modules/tasks/application/commands/link-tasks";
import {
  RecordNoteHandler,
  type RecordNoteCommand,
} from "@/modules/tasks/application/commands/record-note";
import {
  StartTaskHandler,
  type StartTaskCommand,
} from "@/modules/tasks/application/commands/start-task";
import {
  UpdateTaskHandler,
  type UpdateTaskCommand,
} from "@/modules/tasks/application/commands/update-task";
import type { TaskReadStore } from "@/modules/tasks/application/ports/task-read-store";
import {
  ListLabelsHandler,
  type ListLabelsQuery,
} from "@/modules/tasks/application/queries/list-labels";
import {
  ListTaskRepositoriesHandler,
  type ListTaskRepositoriesQuery,
} from "@/modules/tasks/application/queries/list-task-repositories";
import {
  ListTasksHandler,
  type ListTasksQuery,
} from "@/modules/tasks/application/queries/list-tasks";
import type {
  LabelItem,
  RepositoryTasks,
  TaskCountsByRepository,
  TaskList,
  TaskRepositoryItem,
} from "@/modules/tasks/application/queries/read-models";
import {
  TaskBriefHandler,
  type TaskBriefQuery,
  type TaskBriefResult,
} from "@/modules/tasks/application/queries/task-brief";
import {
  TaskCountsByRepositoryHandler,
  type TaskCountsByRepositoryQuery,
} from "@/modules/tasks/application/queries/task-counts-by-repository";
import {
  TasksForRepositoryHandler,
  type TasksForRepositoryQuery,
} from "@/modules/tasks/application/queries/tasks-for-repository";
import type { LabelRepository, TaskRepository } from "@/modules/tasks/domain";
import { DrizzleLabelRepository } from "@/modules/tasks/infrastructure/drizzle-label.repository";
import { DrizzleTaskReadStore } from "@/modules/tasks/infrastructure/drizzle-task.read-store";
import { DrizzleTaskRepository } from "@/modules/tasks/infrastructure/drizzle-task.repository";
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
  readonly tasks: TaskRepository;
  readonly labels: LabelRepository;
  readonly taskReads: TaskReadStore;
  readonly accessTokens: AccessTokenRepository;
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
  commandBus.register<PinRepositoryCommand>(
    "github-insights.pin-repository",
    new PinRepositoryHandler(watchedRepositories),
  );
  commandBus.register<UnpinRepositoryCommand>(
    "github-insights.unpin-repository",
    new UnpinRepositoryHandler(watchedRepositories),
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
  queryBus.register<WatchableRepositoriesQuery, WatchableRepositoriesResult>(
    "github-insights.watchable-repositories",
    new WatchableRepositoriesHandler(gitHub, watchedRepositories),
  );
  queryBus.register<WatchedRepositoryNamesQuery, WatchedRepositoryName[]>(
    "github-insights.watched-repository-names",
    new WatchedRepositoryNamesHandler(watchedRepositories),
  );
  queryBus.register<SignedInUserQuery, SignedInUser | null>(
    "identity.signed-in-user",
    new SignedInUserHandler(parts.authenticator),
  );
  registerTasks(commandBus, queryBus, parts);
  registerAccessTokens(commandBus, queryBus, parts);

  return { commandBus, queryBus };
}

function registerTasks(
  commandBus: CommandBus,
  queryBus: QueryBus,
  { tasks, labels, taskReads, clock }: ContainerParts,
): void {
  commandBus.register<CreateTaskCommand>(
    "tasks.create-task",
    new CreateTaskHandler(tasks, labels, clock),
  );
  commandBus.register<UpdateTaskCommand>(
    "tasks.update-task",
    new UpdateTaskHandler(tasks, labels, clock),
  );
  commandBus.register<CreateLabelCommand>(
    "tasks.create-label",
    new CreateLabelHandler(labels, clock),
  );
  commandBus.register<StartTaskCommand>(
    "tasks.start-task",
    new StartTaskHandler(tasks, clock),
  );
  commandBus.register<FinishSessionCommand>(
    "tasks.finish-session",
    new FinishSessionHandler(tasks, clock),
  );
  commandBus.register<RecordNoteCommand>(
    "tasks.record-note",
    new RecordNoteHandler(tasks, clock),
  );
  commandBus.register<CheckCriterionCommand>(
    "tasks.check-criterion",
    new CheckCriterionHandler(tasks, clock),
  );
  commandBus.register<LinkTasksCommand>(
    "tasks.link-tasks",
    new LinkTasksHandler(tasks, clock),
  );
  commandBus.register<ChangeStatusCommand>(
    "tasks.change-status",
    new ChangeStatusHandler(tasks, clock),
  );

  queryBus.register<ListTasksQuery, TaskList>(
    "tasks.list-tasks",
    new ListTasksHandler(taskReads, clock),
  );
  queryBus.register<ListLabelsQuery, LabelItem[]>(
    "tasks.list-labels",
    new ListLabelsHandler(taskReads),
  );
  queryBus.register<ListTaskRepositoriesQuery, TaskRepositoryItem[]>(
    "tasks.list-task-repositories",
    new ListTaskRepositoriesHandler(taskReads),
  );
  queryBus.register<TaskBriefQuery, TaskBriefResult>(
    "tasks.task-brief",
    new TaskBriefHandler(taskReads, clock),
  );
  queryBus.register<TaskCountsByRepositoryQuery, TaskCountsByRepository>(
    "tasks.task-counts-by-repository",
    new TaskCountsByRepositoryHandler(taskReads, clock),
  );
  queryBus.register<TasksForRepositoryQuery, RepositoryTasks>(
    "tasks.tasks-for-repository",
    new TasksForRepositoryHandler(taskReads, clock),
  );
}

function registerAccessTokens(
  commandBus: CommandBus,
  queryBus: QueryBus,
  { accessTokens, clock }: ContainerParts,
): void {
  commandBus.register<IssueAccessTokenCommand>(
    "identity.issue-access-token",
    new IssueAccessTokenHandler(accessTokens, clock),
  );
  commandBus.register<RevokeAccessTokenCommand>(
    "identity.revoke-access-token",
    new RevokeAccessTokenHandler(accessTokens, clock),
  );
  commandBus.register<RecordAccessTokenUseCommand>(
    "identity.record-access-token-use",
    new RecordAccessTokenUseHandler(accessTokens, clock),
  );
  queryBus.register<AccessTokensQuery, AccessTokenSummary[]>(
    "identity.access-tokens",
    new AccessTokensHandler(accessTokens, clock),
  );
  queryBus.register<AuthenticateAgentQuery, AuthenticateAgentResult>(
    "identity.authenticate-agent",
    new AuthenticateAgentHandler(accessTokens, clock),
  );
}

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
  return containerFor(
    viewer?.accessToken ?? null,
    now ? () => now : () => new Date(),
  );
}

/**
 * For the MCP server. An agent proves who it is with an access token rather
 * than a session cookie, so nothing here reads the request, and nothing reads
 * GitHub on its behalf.
 */
export function getAgentContainer(): Container {
  return containerFor(null, () => new Date());
}

function containerFor(
  gitHubToken: string | null,
  clock: () => Date,
): Container {
  const db = getDatabase();
  return buildContainer({
    watchedRepositories: new DrizzleWatchedRepositoryRepository(db),
    snapshots: new DrizzleRepositorySnapshotStore(db),
    gitHub: new GitHubGraphqlGateway(gitHubToken),
    tasks: new DrizzleTaskRepository(db),
    labels: new DrizzleLabelRepository(db),
    taskReads: new DrizzleTaskReadStore(db),
    accessTokens: new DrizzleAccessTokenRepository(db),
    authenticator,
    clock,
  });
}

export function getAuthenticator(): Authenticator {
  return authenticator;
}

/** Better Auth's own endpoints: the OAuth callback, session and sign-out. */
export function handleAuthRequest(request: Request): Promise<Response> {
  return auth().handler(request);
}
