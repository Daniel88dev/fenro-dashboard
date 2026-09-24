import { Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { RepositoryTasks } from "@/modules/tasks/application/queries/read-models";
import { Chip } from "@/modules/github-insights/ui/chip";
import {
  Panel,
  PanelList,
  PanelSummary,
} from "@/modules/github-insights/ui/panel";

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
      title="Tasks"
      summary={<PanelSummary>{data.summary}</PanelSummary>}
      action={
        <Link
          href={`/tasks/new?repository=${scoped}`}
          scroll={false}
          className="border-hairline bg-surface text-ink hover:bg-surface-raised focus-visible:outline-pr flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium focus-visible:outline-2"
        >
          <Plus aria-hidden="true" weight="bold" className="size-[13px]" />
          New task here
        </Link>
      }
      footer={
        hidden > 0 ? (
          <Link
            href={`/tasks?repository=${scoped}`}
            className="text-ink-muted hover:text-ink underline-offset-2 hover:underline"
          >
            {`Show the other ${hidden}`}
          </Link>
        ) : null
      }
    >
      {data.shown.length > 0 ? (
        <PanelList>
          {data.shown.map((task) => (
            <li key={task.id}>
              <Link
                href={taskHref(task.id)}
                scroll={false}
                className="hover:bg-surface-raised focus-visible:outline-pr grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <span className="text-ink-faint font-mono text-[12.5px]">
                  {task.id}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-ink truncate text-[13.5px]">
                    {task.title}
                  </span>
                  <span className="text-ink-muted truncate text-[12px]">
                    {task.lastActivity}
                  </span>
                </span>
                <Chip tone={STATE_TONES[task.state]}>{task.state}</Chip>
              </Link>
            </li>
          ))}
        </PanelList>
      ) : null}
    </Panel>
  );
}
