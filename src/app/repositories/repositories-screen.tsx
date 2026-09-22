import type { ReactNode } from "react";

import { dashboardTotalsQuery } from "@/modules/github-insights/application/queries/dashboard-totals";
import { openIssuesQuery } from "@/modules/github-insights/application/queries/open-issues";
import { openPullRequestsQuery } from "@/modules/github-insights/application/queries/open-pull-requests";
import { pullRequestChecksQuery } from "@/modules/github-insights/application/queries/pull-request-checks";
import { repositoryRowsQuery } from "@/modules/github-insights/application/queries/repository-rows";
import type { RepositoryRow } from "@/modules/github-insights/application/queries/read-models";
import { DashboardHeader } from "@/modules/github-insights/ui/dashboard-header";
import { IssuesPanel } from "@/modules/github-insights/ui/issues-panel";
import { PanelError } from "@/modules/github-insights/ui/panel";
import {
  PullRequestsPanel,
  type PullRequestView,
} from "@/modules/github-insights/ui/pull-requests-panel";
import {
  RepositoryTable,
  type ColumnToggle,
  type RepositoryRowView,
} from "@/modules/github-insights/ui/repository-table";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { taskCountsByRepositoryQuery } from "@/modules/tasks/application/queries/task-counts-by-repository";
import { tasksForRepositoryQuery } from "@/modules/tasks/application/queries/tasks-for-repository";
import { TasksPanel } from "@/modules/tasks/ui/tasks-panel";
import { isErr } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "../sign-in/actions";
import { unwatchRepositoryAction, watchRepositoryAction } from "./actions";
import {
  isOpen,
  isPullRequestOpen,
  panelId,
  parseExpansion,
  togglePanelHref,
  togglePullRequestHref,
  type Column,
  type ExpansionState,
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
  if (!(await queryBus.ask(signedInUserQuery()))) {
    return <SignInPanel action={signInWithGitHubAction} />;
  }

  const [rows, totals, taskCounts] = await Promise.all([
    queryBus.ask(repositoryRowsQuery()),
    queryBus.ask(dashboardTotalsQuery()),
    queryBus.ask(taskCountsByRepositoryQuery()),
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

  const views: RepositoryRowView[] = await Promise.all(
    visible.map(async (row) => {
      const fullName = `${row.owner}/${row.name}`;
      const taskCount = taskCounts[fullName] ?? {
        total: 0,
        running: 0,
        hint: "no tasks",
      };

      const panels: { key: string; node: ReactNode }[] = [];

      if (isOpen(state, { ...row, column: "prs" })) {
        panels.push({
          key: "prs",
          node: await pullRequestsPanel(queryBus, state, row, now),
        });
      }
      if (isOpen(state, { ...row, column: "issues" })) {
        panels.push({
          key: "issues",
          node: await issuesPanel(queryBus, row, now),
        });
      }
      if (isOpen(state, { ...row, column: "tasks" })) {
        panels.push({ key: "tasks", node: await tasksPanel(queryBus, row) });
      }

      return {
        id: row.id,
        owner: row.owner,
        name: row.name,
        lastActivityAt: row.lastActivityAt,
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
    }),
  );

  return (
    <>
      <DashboardHeader
        totals={totals.value}
        openTasks={openTasks}
        filter={state.filter}
        watchAction={watchRepositoryAction}
      />
      <RepositoryTable
        rows={views}
        now={now}
        unwatchAction={unwatchRepositoryAction}
      />
    </>
  );
}

type Bus = Awaited<ReturnType<typeof getContainer>>["queryBus"];

async function pullRequestsPanel(
  queryBus: Bus,
  state: ExpansionState,
  row: { owner: string; name: string },
  now: Date,
): Promise<ReactNode> {
  const id = panelId({ ...row, column: "prs" });
  const result = await queryBus.ask(openPullRequestsQuery(row.owner, row.name));
  if (isErr(result)) {
    return (
      <PanelError
        id={id}
        title="Open pull requests"
        message={result.error.message}
      />
    );
  }

  const views: PullRequestView[] = await Promise.all(
    result.value.shown.map(async (summary) => {
      const expanded = isPullRequestOpen(
        state,
        row.owner,
        row.name,
        summary.number,
      );
      const checks = expanded
        ? await queryBus.ask(
            pullRequestChecksQuery(row.owner, row.name, summary.number),
          )
        : null;

      return {
        summary,
        expanded,
        href: togglePullRequestHref(
          PATH,
          state,
          row.owner,
          row.name,
          summary.number,
        ),
        checksId: `${id}-pr-${summary.number}`,
        checks: checks && !isErr(checks) ? checks.value : null,
      };
    }),
  );

  return (
    <PullRequestsPanel
      id={id}
      owner={row.owner}
      name={row.name}
      data={result.value}
      views={views}
      now={now}
    />
  );
}

async function issuesPanel(
  queryBus: Bus,
  row: { owner: string; name: string },
  now: Date,
): Promise<ReactNode> {
  const id = panelId({ ...row, column: "issues" });
  const result = await queryBus.ask(openIssuesQuery(row.owner, row.name));
  if (isErr(result)) {
    return (
      <PanelError id={id} title="Open issues" message={result.error.message} />
    );
  }

  return (
    <IssuesPanel
      id={id}
      owner={row.owner}
      name={row.name}
      data={result.value}
      now={now}
    />
  );
}

async function tasksPanel(
  queryBus: Bus,
  row: { owner: string; name: string },
): Promise<ReactNode> {
  const id = panelId({ ...row, column: "tasks" });
  const data = await queryBus.ask(tasksForRepositoryQuery(row.owner, row.name));
  return <TasksPanel id={id} data={data} />;
}
