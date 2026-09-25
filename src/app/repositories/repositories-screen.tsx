import { Suspense, type ReactNode } from "react";

import { dashboardTotalsQuery } from "@/modules/github-insights/application/queries/dashboard-totals";
import { openIssuesQuery } from "@/modules/github-insights/application/queries/open-issues";
import { openPullRequestsQuery } from "@/modules/github-insights/application/queries/open-pull-requests";
import { pullRequestChecksQuery } from "@/modules/github-insights/application/queries/pull-request-checks";
import { repositoryRowsQuery } from "@/modules/github-insights/application/queries/repository-rows";
import type { Watcher } from "@/modules/github-insights/application/ports/viewer";
import type {
  IssueFilter,
  RepositoryRow,
} from "@/modules/github-insights/application/queries/read-models";
import { AddRepositories } from "@/modules/github-insights/ui/add-repositories";
import { DashboardHeader } from "@/modules/github-insights/ui/dashboard-header";
import {
  IssuesPanel,
  type IssueChipView,
} from "@/modules/github-insights/ui/issues-panel";
import {
  ChecksLoading,
  ChecksMessage,
  PanelError,
  PanelLoading,
} from "@/modules/github-insights/ui/panel";
import {
  ChecksBoundary,
  PanelBoundary,
} from "@/modules/github-insights/ui/panel-boundary";
import { PullRequestChecksView } from "@/modules/github-insights/ui/pull-request-checks-view";
import {
  PullRequestsPanel,
  type PullRequestView,
} from "@/modules/github-insights/ui/pull-requests-panel";
import {
  RepositoryTable,
  type ColumnToggle,
  type RepositoryRowView,
} from "@/modules/github-insights/ui/repository-table";
import { SyncProvider } from "@/modules/github-insights/ui/sync-context";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { taskCountsByRepositoryQuery } from "@/modules/tasks/application/queries/task-counts-by-repository";
import { tasksForRepositoryQuery } from "@/modules/tasks/application/queries/tasks-for-repository";
import { TasksPanel } from "@/modules/tasks/ui/tasks-panel";
import { isErr } from "@/shared/domain";
import {
  getAuthenticator,
  getContainer,
} from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../sign-in/actions";
import {
  addRepositoriesAction,
  pinRepositoryAction,
  syncRepositoriesAction,
  unwatchRepositoryAction,
} from "./actions";
import {
  isIssueChipPressed,
  isOpen,
  isPullRequestOpen,
  panelId,
  parseExpansion,
  toggleIssueChipHref,
  togglePanelHref,
  togglePullRequestHref,
  type Column,
  type ExpansionState,
  type IssueChip,
  type SearchParams,
} from "./expansion";

const PATH = "/repositories";

function matchesFilter(row: RepositoryRow, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return (
    row.name.toLowerCase().includes(needle) ||
    row.owner.toLowerCase().includes(needle) ||
    `${row.owner}/${row.name}`.toLowerCase().includes(needle)
  );
}

function toggleFor(
  state: ExpansionState,
  row: { owner: string; name: string },
  column: Column,
  count: number,
  hint: string,
  noun: string,
): ColumnToggle {
  const key = { owner: row.owner, name: row.name, column };
  return {
    count,
    hint,
    // A count alone is not an accessible name.
    label: `${count} ${noun} in ${row.owner}/${row.name}`,
    href: togglePanelHref(PATH, state, key),
    expanded: isOpen(state, key),
    panelId: panelId(key),
  };
}

/**
 * The route is where the two contexts meet: it asks both buses and zips the
 * results on `owner/name`, so neither context has to know the other exists.
 */
export async function RepositoriesScreen({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const state = parseExpansion(await searchParams);
  const now = new Date();
  const { queryBus } = await getContainer(now);

  // "You" is the signed-in GitHub account (ticket 03); without one there is
  // nobody to read GitHub as, so the table waits for sign-in.
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return <SignInPanel action={signInWithGitHubAction} />;
  }
  const watcher: Watcher = { id: user.id, login: user.githubLogin };

  const [rows, totals, taskCounts] = await Promise.all([
    queryBus.ask(repositoryRowsQuery(watcher)),
    queryBus.ask(dashboardTotalsQuery(watcher)),
    queryBus.ask(taskCountsByRepositoryQuery(user.id)),
  ]);

  if (isErr(rows) || isErr(totals)) {
    const message = isErr(rows)
      ? rows.error.message
      : "Counts are unavailable.";
    return (
      <>
        <PanelError
          id="repositories-error"
          title="Repositories"
          message={message}
        />
      </>
    );
  }

  const visible = rows.value.filter((row) => matchesFilter(row, state.filter));
  const openTasks = Object.values(taskCounts).reduce(
    (total, count) => total + count.total,
    0,
  );

  const views: RepositoryRowView[] = visible.map((row) => {
    const fullName = `${row.owner}/${row.name}`;
    const taskCount = taskCounts[fullName.toLowerCase()] ?? {
      total: 0,
      running: 0,
      hint: "no tasks",
    };

    // Each open panel streams in behind its own boundary, so several rows
    // open at once load side by side and one failing leaves the rest.
    const panels: { key: string; node: ReactNode }[] = [];
    const repository = { owner: row.owner, name: row.name };

    if (isOpen(state, { ...repository, column: "prs" })) {
      panels.push({
        key: "prs",
        node: (
          <StreamedPanel
            id={panelId({ ...repository, column: "prs" })}
            title="Open pull requests"
            what="pull requests"
          >
            <PullRequestsSection
              queryBus={queryBus}
              watcher={watcher}
              state={state}
              repository={repository}
              now={now}
            />
          </StreamedPanel>
        ),
      });
    }
    if (isOpen(state, { ...repository, column: "issues" })) {
      panels.push({
        key: "issues",
        node: (
          <StreamedPanel
            id={panelId({ ...repository, column: "issues" })}
            title="Open issues"
            what="issues"
          >
            <IssuesSection
              queryBus={queryBus}
              watcher={watcher}
              state={state}
              repository={repository}
              now={now}
            />
          </StreamedPanel>
        ),
      });
    }
    if (isOpen(state, { ...repository, column: "tasks" })) {
      panels.push({
        key: "tasks",
        node: (
          <StreamedPanel
            id={panelId({ ...repository, column: "tasks" })}
            title="Tasks"
            what="tasks"
          >
            <TasksSection
              queryBus={queryBus}
              ownerId={user.id}
              repository={repository}
            />
          </StreamedPanel>
        ),
      });
    }

    return {
      id: row.id,
      owner: row.owner,
      name: row.name,
      pinned: row.pinned,
      lastActivityAt: row.lastActivityAt,
      syncFailure: row.syncFailure,
      rateLimited: row.rateLimited,
      pullRequests: toggleFor(
        state,
        row,
        "prs",
        row.openPullRequests,
        row.pullRequestHint,
        "open pull requests",
      ),
      issues: toggleFor(
        state,
        row,
        "issues",
        row.openIssues,
        row.issueHint,
        "open issues",
      ),
      tasks: toggleFor(
        state,
        row,
        "tasks",
        taskCount.total,
        taskCount.hint,
        "tasks",
      ),
      panels,
    };
  });

  // Every row syncs, filtered out or not: the filter narrows what is shown,
  // not what is kept fresh.
  return (
    <SyncProvider
      action={syncRepositoriesAction}
      repositoryIds={rows.value.map((row) => row.id)}
      dueIds={rows.value.filter((row) => row.needsSync).map((row) => row.id)}
    >
      <DashboardHeader
        totals={totals.value}
        openTasks={openTasks}
        filter={state.filter}
        now={now}
        addAction={addRepositoriesAction}
        repositoriesSource="/api/github/repositories"
        accessSettingsUrl={getAuthenticator().gitHubAccessSettingsUrl()}
      />
      <RepositoryTable
        rows={views}
        now={now}
        pinAction={pinRepositoryAction}
        unwatchAction={unwatchRepositoryAction}
        filteredOut={rows.value.length > 0}
        emptyAction={
          <AddRepositories
            source="/api/github/repositories"
            action={addRepositoriesAction}
            accessSettingsUrl={getAuthenticator().gitHubAccessSettingsUrl()}
          />
        }
      />
    </SyncProvider>
  );
}

type Bus = Awaited<ReturnType<typeof getContainer>>["queryBus"];

type Repository = { readonly owner: string; readonly name: string };

function StreamedPanel({
  id,
  title,
  what,
  children,
}: {
  id: string;
  title: string;
  what: string;
  children: ReactNode;
}) {
  const noun = `The ${what}`;
  return (
    <PanelBoundary id={id} title={title} what={noun}>
      <Suspense fallback={<PanelLoading id={id} title={title} what={what} />}>
        {children}
      </Suspense>
    </PanelBoundary>
  );
}

async function PullRequestsSection({
  queryBus,
  watcher,
  state,
  repository,
  now,
}: {
  queryBus: Bus;
  watcher: Watcher;
  state: ExpansionState;
  repository: Repository;
  now: Date;
}) {
  const { owner, name } = repository;
  const id = panelId({ owner, name, column: "prs" });
  const result = await queryBus.ask(
    openPullRequestsQuery(watcher, owner, name),
  );
  if (isErr(result)) {
    return (
      <PanelError
        id={id}
        title="Open pull requests"
        message={result.error.message}
      />
    );
  }

  const views: PullRequestView[] = result.value.shown.map((summary) => {
    const checksId = `${id}-pr-${summary.number}`;
    const expanded = isPullRequestOpen(state, owner, name, summary.number);
    return {
      summary,
      expanded,
      href: togglePullRequestHref(PATH, state, owner, name, summary.number),
      checksId,
      checks: expanded ? (
        <ChecksBoundary id={checksId} number={summary.number}>
          <Suspense
            fallback={<ChecksLoading id={checksId} number={summary.number} />}
          >
            <ChecksSection
              queryBus={queryBus}
              watcher={watcher}
              repository={repository}
              number={summary.number}
              id={checksId}
            />
          </Suspense>
        </ChecksBoundary>
      ) : null,
    };
  });

  return (
    <PullRequestsPanel
      id={id}
      owner={owner}
      name={name}
      data={result.value}
      views={views}
      now={now}
    />
  );
}

async function ChecksSection({
  queryBus,
  watcher,
  repository,
  number,
  id,
}: {
  queryBus: Bus;
  watcher: Watcher;
  repository: Repository;
  number: number;
  id: string;
}) {
  const { owner, name } = repository;
  const pullRequestUrl = `https://github.com/${owner}/${name}/pull/${number}`;
  const checks = await queryBus.ask(
    pullRequestChecksQuery(watcher, owner, name, number),
  );
  if (isErr(checks)) {
    return (
      <ChecksMessage id={id} tone="attention">
        {checks.error.message}
      </ChecksMessage>
    );
  }
  if (checks.value === null) {
    return (
      <ChecksMessage id={id} tone="neutral">
        {`#${number} was not in the last sync. It may have been merged or closed since.`}
      </ChecksMessage>
    );
  }
  return (
    <PullRequestChecksView
      id={id}
      checks={checks.value}
      // The seam between the two contexts: the tasks side takes it from here.
      newTaskHref={`/tasks/new?repository=${encodeURIComponent(`${owner}/${name}`)}&from=${encodeURIComponent(pullRequestUrl)}`}
    />
  );
}

const ISSUE_CHIP_LABELS: Record<IssueChip, string> = {
  assigned: "Assigned to me",
  triage: "Needs triage",
  oldest: "Oldest first",
};

function issueFilterFor(
  state: ExpansionState,
  { owner, name }: Repository,
): IssueFilter {
  const pressed = (chip: IssueChip) =>
    isIssueChipPressed(state, owner, name, chip);
  return {
    assignedToMe: pressed("assigned"),
    needsTriage: pressed("triage"),
    order: pressed("oldest") ? "oldest" : "attention",
  };
}

async function IssuesSection({
  queryBus,
  watcher,
  state,
  repository,
  now,
}: {
  queryBus: Bus;
  watcher: Watcher;
  state: ExpansionState;
  repository: Repository;
  now: Date;
}) {
  const { owner, name } = repository;
  const id = panelId({ owner, name, column: "issues" });
  const filter = issueFilterFor(state, repository);
  const result = await queryBus.ask(
    openIssuesQuery(watcher, owner, name, filter),
  );
  if (isErr(result)) {
    return (
      <PanelError id={id} title="Open issues" message={result.error.message} />
    );
  }

  const chips: IssueChipView[] = (
    Object.keys(ISSUE_CHIP_LABELS) as IssueChip[]
  ).map((chip) => ({
    label: ISSUE_CHIP_LABELS[chip],
    href: toggleIssueChipHref(PATH, state, owner, name, chip),
    pressed: isIssueChipPressed(state, owner, name, chip),
  }));

  return (
    <IssuesPanel
      id={id}
      owner={owner}
      name={name}
      data={result.value}
      filter={filter}
      chips={chips}
      now={now}
    />
  );
}

async function TasksSection({
  queryBus,
  ownerId,
  repository,
}: {
  queryBus: Bus;
  ownerId: string;
  repository: Repository;
}) {
  const { owner, name } = repository;
  const id = panelId({ owner, name, column: "tasks" });
  const data = await queryBus.ask(
    tasksForRepositoryQuery(ownerId, owner, name),
  );
  return <TasksPanel id={id} data={data} repository={`${owner}/${name}`} />;
}
