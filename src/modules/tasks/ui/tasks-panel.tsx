import Link from "next/link";

import type { RepositoryTasks } from "@/modules/tasks/application/queries/read-models";
import { Chip } from "@/modules/github-insights/ui/chip";
import { Panel } from "@/modules/github-insights/ui/panel";

import { STATE_TONES, taskHref } from "./task-state";

/**
 * The column that makes this a dashboard for your work rather than a second
 * GitHub. Agents work these tasks through the MCP server; a person opens them
 * here, or starts a new one already scoped to the repository.
 */
export function TasksPanel({
  id,
  data,
  repository,
}: {
  id: string;
  data: RepositoryTasks;
  /** `owner/name`, as GitHub spells it. */
  repository: string;
}) {
  const hidden = data.total - data.shown.length;
  const scoped = encodeURIComponent(repository);

  return (
    <Panel
      id={id}
      title="Tasks on this repository"
      summary={data.summary}
      footer={
        <span className="flex items-center gap-3">
          <Link
            href={`/tasks/new?repository=${scoped}`}
            className="border-ink bg-ink text-ground hover:bg-ink-soft rounded-lg border px-[11px] py-1.5 text-[12px] font-medium"
          >
            New task here
          </Link>
          {hidden > 0 ? (
            <Link
              href={`/tasks?repository=${scoped}`}
              className="text-ink-muted hover:text-ink underline-offset-2 hover:underline"
            >
              {`Show the other ${hidden}`}
            </Link>
          ) : null}
        </span>
      }
    >
      {data.shown.map((task) => (
        <Link
          key={task.id}
          href={taskHref(task.id)}
          className="border-hairline bg-surface hover:bg-surface-raised focus-visible:outline-pr flex items-center gap-3 rounded-[9px] border px-[13px] py-2.5 focus-visible:outline-2"
        >
          <span className="text-ink-faint w-[54px] shrink-0 font-mono text-[12.5px]">
            {task.id}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-ink truncate text-[13px]">{task.title}</span>
            <span className="text-ink-muted text-[11.5px]">
              {task.lastActivity}
            </span>
          </span>
          <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
          <span className="text-ink-faint w-[96px] shrink-0 text-right text-[11.5px]">
            {task.contextItems === 1
              ? "1 context item"
              : `${task.contextItems} context items`}
          </span>
        </Link>
      ))}
    </Panel>
  );
}
