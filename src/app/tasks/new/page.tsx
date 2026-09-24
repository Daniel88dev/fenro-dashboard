import Link from "next/link";
import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { NewTaskForm } from "@/modules/tasks/ui/task-forms";

import { signInWithGitHubAction } from "../../sign-in/actions";
import { SignedInAccount } from "../../signed-in-account";
import { tasksContext } from "../signed-in-owner";
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
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

  const { ownerId } = await tasksContext();
  if (!ownerId) {
    return (
      <SignInPanel
        heading="Sign in to create tasks"
        action={signInWithGitHubAction}
      />
    );
  }

  const source = one(params.from);
  const pullRequest = /\/pull\/(\d+)$/.exec(source);
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <nav aria-label="Breadcrumb" className="text-ink-muted text-[12.5px]">
          <Link href="/tasks" className="hover:text-ink">
            Tasks
          </Link>
        </nav>
        <h1 className="text-ink text-[22px] font-semibold tracking-tight">
          New task
        </h1>
        <p className="text-ink-muted text-[13px]">
          Write it for the agent that will pick it up: what to do, how to know
          it is done, and where it came from.
        </p>
      </header>
      <section className="border-hairline bg-surface rounded-xl border px-6 py-6">
        <NewTaskForm
          action={TASK_ACTIONS.create}
          defaults={{
            repository: one(params.repository),
            parent: one(params.parent),
            source,
            title:
              one(params.title) ||
              (pullRequest ? `Get pull request #${pullRequest[1]} merged` : ""),
          }}
        />
      </section>
    </div>
  );
}
