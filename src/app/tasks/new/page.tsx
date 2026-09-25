import { CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { NewTaskForm } from "@/modules/tasks/ui/task-forms";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import { tasksContext } from "../signed-in-owner";
import { newTaskDefaults } from "./defaults";
import { TASK_ACTIONS } from "../task-actions";

export const metadata = {
  title: "New task · Fenro Dashboard",
};

/**
 * Reached from the Tasks page, from "New task here" on a repository, from
 * "Make a task from this" on a pull request, and from "Add sub-task". Each
 * arrives with the query parameters that pre-fill the form.
 */
export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <DashboardChrome
      current="tasks"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<TaskLoading what="the form" />}>
        <NewTaskScreen searchParams={searchParams} />
      </Suspense>
    </DashboardChrome>
  );
}

async function NewTaskScreen({
  searchParams,
}: {
  searchParams: PageProps<"/tasks/new">["searchParams"];
}) {
  const params = await searchParams;

  const { container, ownerId } = await tasksContext();
  if (!ownerId) {
    return (
      <SignInPanel
        heading="Sign in to create tasks"
        action={signInWithGitHubAction}
      />
    );
  }

  return (
    <div className="flex max-w-[1040px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav
          aria-label="Breadcrumb"
          className="text-ink-muted flex items-center gap-1.5 text-[12.5px]"
        >
          <Link href="/tasks" className="hover:text-ink">
            Tasks
          </Link>
          <CaretRight aria-hidden="true" className="size-[11px]" />
          <span>New task</span>
        </nav>
        <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
          New task
        </h1>
        <p className="text-ink-muted text-[13.5px]">
          What you write here is the brief an agent reads when it picks the task
          up.
        </p>
      </header>
      <NewTaskForm
        action={TASK_ACTIONS.create}
        defaults={newTaskDefaults(params)}
        labels={await container.queryBus.ask(listLabelsQuery(ownerId))}
        cancel={
          <Link
            href="/tasks"
            className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr flex h-[34px] items-center rounded-lg px-[13px] text-[12.5px] font-medium focus-visible:outline-2"
          >
            Cancel
          </Link>
        }
      />
    </div>
  );
}
