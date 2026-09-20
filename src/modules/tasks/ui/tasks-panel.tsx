import type { RepositoryTasks } from "@/modules/tasks/application/queries/read-models";
import { Chip, type Tone } from "@/modules/github-insights/ui/chip";
import { Panel } from "@/modules/github-insights/ui/panel";

const STATE_TONES: Record<string, Tone> = {
  running: "healthy",
  ready: "healthy",
  blocked: "attention",
  paused: "neutral",
  queued: "neutral",
};

/**
 * The column that makes this a dashboard for your work rather than a second
 * GitHub. Its actions — starting and resuming a session — arrive with the
 * `Task` aggregate in a later slice.
 */
export function TasksPanel({
  id,
  data,
}: {
  id: string;
  data: RepositoryTasks;
}) {
  const hidden = data.total - data.shown.length;

  return (
    <Panel
      id={id}
      title="Tasks on this repository"
      summary={data.summary}
      footer={
        hidden > 0 ? (
          <span className="text-ink-muted">
            {`${hidden} more not shown yet.`}
          </span>
        ) : null
      }
    >
      {data.shown.map((task) => (
        <div
          key={task.id}
          className="border-hairline bg-surface flex items-center gap-3 rounded-[9px] border px-[13px] py-2.5"
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
          <Chip tone={STATE_TONES[task.state] ?? "neutral"}>{task.state}</Chip>
          <span className="text-ink-faint w-[96px] shrink-0 text-right text-[11.5px]">
            {task.contextItems === 1
              ? "1 context item"
              : `${task.contextItems} context items`}
          </span>
        </div>
      ))}
    </Panel>
  );
}
